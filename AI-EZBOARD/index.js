const puppeteer = require("puppeteer");
const readline = require("readline");

let ROOM_CODE = process.argv[2];
const BASE_URL = process.argv[3] || "https://ezboard.vyasdevgna.online";

if (!ROOM_CODE) {
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

      const newElementsJson = await new Promise((resolve) => {
        let buffer = "";
        let reading = false;
        
        const onLine = (line) => {
          if (line === "=== EZBOARD_REPLY_START ===") {
            reading = true;
            buffer = "";
          } else if (line === "=== EZBOARD_REPLY_END ===") {
            reading = false;
            rl.removeListener("line", onLine);
            resolve(buffer);
          } else if (reading) {
            buffer += line + "\n";
          }
        };
        rl.on("line", onLine);
      });

      const newElements = JSON.parse(newElementsJson);
      console.log(`[INFO] Received ${newElements.length} elements from Agent.`);
      
      if (newElements.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of newElements) {
          if (el.x < minX) minX = el.x;
          if (el.y < minY) minY = el.y;
          if (el.x + el.width > maxX) maxX = el.x + el.width;
          if (el.y + el.height > maxY) maxY = el.y + el.height;
        }
        
        if (minX !== Infinity) {
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          
          const viewportCoords = await page.evaluate((cx, cy) => {
            const state = window.excalidrawAPI.getAppState();
            const vx = (cx + state.scrollX) * state.zoom.value;
            const vy = (cy + state.scrollY) * state.zoom.value;
            return { x: vx, y: vy };
          }, centerX, centerY);
          
          await page.mouse.move(viewportCoords.x, viewportCoords.y, { steps: 25 });
          await new Promise(r => setTimeout(r, 600)); 
        }
      }

      console.log(`[INFO] Applying elements to board...`);
      await page.evaluate((newElementsStr) => {
        window.excalidrawAPI.updateScene({ elements: JSON.parse(newElementsStr), commitToHistory: false });
      }, JSON.stringify(newElements));

    } catch (err) {
      console.error("[ERROR] Failed to process request:", err);
    }
  });
}

main().catch(console.error);
