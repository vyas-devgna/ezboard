const puppeteer = require("puppeteer");
const readline = require("readline");

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

let pendingRequests = [];
let buffer = "";
let reading = false;

rl.on("line", (line) => {
  if (line.trim() === "=== EZBOARD_REPLY_START ===") {
    reading = true;
    buffer = "";
  } else if (line.trim() === "=== EZBOARD_REPLY_END ===") {
    reading = false;
    if (pendingRequests.length > 0) {
      const resolve = pendingRequests.shift();
      resolve(buffer);
    }
  } else if (reading) {
    buffer += line + "\n";
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

      try {
        const metadata = process.env.ANTIGRAVITY_SOURCE_METADATA;
        if (metadata) {
          const parsed = JSON.parse(metadata);
          const conversationId = parsed.tool?.conversationId || parsed.conversationId;
          if (conversationId) {
            const { exec } = require("child_process");
            const payloadStr = JSON.stringify(promptData).replace(/"/g, '\\"');
            const msg = `=== EZBOARD_PROMPT_START ===\\n${payloadStr}\\n=== EZBOARD_PROMPT_END ===`;
            exec(`agentapi send-message ${conversationId} "${msg}"`, (err) => {
              if (err) console.error("[ERROR] Failed to send message via agentapi:", err);
            });
          }
        }
      } catch (err) {
        console.error("[ERROR] Failed to extract conversation ID:", err);
      }

      const newElementsJson = await new Promise((resolve) => {
        pendingRequests.push(resolve);
      });

      let payload;
      try {
        payload = JSON.parse(newElementsJson);
      } catch (err) {
        console.error("[ERROR] JSON parse failed:", err.message, "Buffer:", newElementsJson);
        await page.evaluate(() => {
          if (window.sendAiChat) window.sendAiChat("ERROR: Agent sent invalid JSON payload.");
        });
        return;
      }
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
