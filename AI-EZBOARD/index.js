const puppeteer = require("puppeteer");
const readline = require("readline");
const { GoogleGenerativeAI } = require("@google/generative-ai");

let ROOM_CODE = process.argv[2];
const BASE_URL = process.argv[3] || "https://ezboard.vyasdevgna.online";

if (!ROOM_CODE || ROOM_CODE === "--auto") {
  // Generate random 5 character valid room code (no I, L, O, 0, 1)
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  ROOM_CODE = "";
  for (let i = 0; i < 5; i++) {
    ROOM_CODE += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  console.log(`[INFO] No room code provided. Generated automatic session code: ${ROOM_CODE}`);
} else {
  // Validate room code
  ROOM_CODE = ROOM_CODE.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (ROOM_CODE.length !== 5 || /[ILO01]/.test(ROOM_CODE)) {
    console.error(`[ERROR] Invalid room code ${ROOM_CODE}. Must be exactly 5 letters/digits, excluding I, L, O, 0, 1.`);
    process.exit(1);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let resolveAiResponse = null;

rl.on("line", (line) => {
  if (resolveAiResponse && line.startsWith("=== EZBOARD_REPLY_END ===")) {
    resolveAiResponse(null);
  }
});

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    // Valid accents: "#6054ee", "#e15d4f", "#118a73", "#ca7a18", "#2473d5"
    const aiAvatarSvg = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%236054ee' rx='20'/%3E%3Ccircle cx='30' cy='40' r='10' fill='white'/%3E%3Ccircle cx='70' cy='40' r='10' fill='white'/%3E%3Cpath d='M30 70 Q50 85 70 70' stroke='white' stroke-width='6' stroke-linecap='round' fill='none'/%3E%3C/svg%3E";
    
    localStorage.setItem("ezboard.profile.v1", JSON.stringify({ 
      actorId: "ai-antigravity-bot",
      name: "Antigravity", 
      accent: "#6054ee",
      avatar: aiAvatarSvg
    }));
  });

  const roomUrl = `${BASE_URL}/#/room/${ROOM_CODE}`;
  console.log(`[INFO] Navigating to ${roomUrl}...`);
  await page.goto(roomUrl, { waitUntil: "networkidle2" });

  console.log("[INFO] Connected to room. Waiting for chats...");

  await page.exposeFunction("onAIChatReceived", async (peerId, message) => {
    try {
      const elements = await page.evaluate(() => window.excalidrawAPI.getSceneElements());
      
      const promptData = {
        peerId,
        message,
        elements
      };
      
      console.log("=== EZBOARD_PROMPT_START ===");
      console.log(JSON.stringify(promptData));
      console.log("=== EZBOARD_PROMPT_END ===");

      if (!process.env.GEMINI_API_KEY) {
        console.log("[ERROR] GEMINI_API_KEY is not set.");
        await page.evaluate(() => {
          if (window.sendAiChat) window.sendAiChat("ERROR: GEMINI_API_KEY environment variable is not set on the server.");
        });
        return;
      }

      console.log("[INFO] Calling Gemini API...");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const systemPrompt = `You are Antigravity, an AI collaborator in an EzBoard drawing session.
You will be provided with the user's prompt and the current JSON array of Excalidraw elements.
You must return a JSON object exactly in this format (no markdown code blocks, just raw JSON):
{
  "message": "A brief, friendly message describing what you did.",
  "elements": [ { new element 1 }, { new element 2 } ]
}
Make your diagrams highly detailed, professional, properly laid out, with colors, arrows and varying font sizes.
Provide new elements with unique 8-character ids, version=1, versionNonce=123.
For coordinates, space elements properly.`;

      const promptStr = `${systemPrompt}\n\nUser Prompt: ${message}\n\nCurrent Elements: ${JSON.stringify(elements)}`;

      const result = await model.generateContent(promptStr);
      let text = result.response.text();
      text = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/g, "").trim();

      const payload = JSON.parse(text);
      let replyMessage = "";
      let newElements = [];
      
      if (Array.isArray(payload)) {
        newElements = payload;
      } else {
        replyMessage = payload.message || "";
        newElements = payload.elements || [];
      }

      if (replyMessage) {
        console.log(`[INFO] Sending AI Chat message: "${replyMessage}"`);
        await page.evaluate((msg) => {
          if (window.sendAiChat) window.sendAiChat(msg);
        }, replyMessage);
      }

      console.log(`[INFO] Received ${newElements.length} elements from Agent. Drawing progressively...`);
      
      const allElements = await page.evaluate(() => window.excalidrawAPI.getSceneElements());

      for (const el of newElements) {
        // Move cursor to element center
        const centerX = el.x + (el.width || 0) / 2;
        const centerY = el.y + (el.height || 0) / 2;
        
        const viewportCoords = await page.evaluate((cx, cy) => {
          const state = window.excalidrawAPI.getAppState();
          const vx = (cx + state.scrollX) * state.zoom.value;
          const vy = (cy + state.scrollY) * state.zoom.value;
          return { x: vx, y: vy };
        }, centerX, centerY);
        
        // Slightly random steps for realistic mouse movement
        await page.mouse.move(viewportCoords.x, viewportCoords.y, { steps: 5 + Math.floor(Math.random() * 5) });
        
        // Pause briefly before drawing
        await new Promise(r => setTimeout(r, 50)); 
        
        // Add element
        allElements.push(el);
        await page.evaluate((els) => {
          window.excalidrawAPI.updateScene({ elements: JSON.parse(els), commitToHistory: false });
        }, JSON.stringify(allElements));
        
        // Pause briefly after drawing
        await new Promise(r => setTimeout(r, 150)); 
      }
      console.log(`[INFO] Finished drawing elements.`);

    } catch (err) {
      console.error("[ERROR] Failed to process request:", err);
    }
  });
}

main().catch(console.error);
