const puppeteer = require("puppeteer");
const readline = require("readline");

const ROOM_CODE = process.argv[2];
const BASE_URL = process.argv[3] || "http://localhost:5173";

if (!ROOM_CODE) {
  console.error("Usage: node index.js <ROOM_CODE> [BASE_URL]");
  process.exit(1);
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
    localStorage.setItem("ezboard-profile", JSON.stringify({ 
      name: "Antigravity", 
      accent: "#8A2BE2",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Antigravity&backgroundColor=8A2BE2"
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
        // Calculate center of new elements in scene coordinates
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
          
          // Get viewport coordinates using Excalidraw appState
          const viewportCoords = await page.evaluate((cx, cy) => {
            const state = window.excalidrawAPI.getAppState();
            const vx = (cx + state.scrollX) * state.zoom.value;
            const vy = (cy + state.scrollY) * state.zoom.value;
            return { x: vx, y: vy };
          }, centerX, centerY);
          
          // Simulate mouse movement (this will broadcast to other peers)
          await page.mouse.move(viewportCoords.x, viewportCoords.y, { steps: 15 });
          // Short delay to let users see the cursor arrive before the drawing appears
          await new Promise(r => setTimeout(r, 400)); 
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
