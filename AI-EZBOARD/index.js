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

// Read lines from stdin
rl.on("line", (line) => {
  if (resolveAiResponse) {
    if (line.startsWith("=== EZBOARD_REPLY_END ===")) {
      resolveAiResponse(null); // Just close the buffer if ended normally?
      // Actually we should buffer lines
    }
  }
});

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("ezboard-profile", JSON.stringify({ name: "AI Collaborator", accent: "#ff00ff" }));
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
      
      // Print to stdout for the Agent to read
      console.log("=== EZBOARD_PROMPT_START ===");
      console.log(JSON.stringify(promptData));
      console.log("=== EZBOARD_PROMPT_END ===");

      // Wait for Agent to reply with JSON elements on stdin
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
      
      console.log(`[INFO] Applying ${newElements.length} elements to board...`);
      await page.evaluate((newElementsStr) => {
        window.excalidrawAPI.updateScene({ elements: JSON.parse(newElementsStr), commitToHistory: false });
      }, JSON.stringify(newElements));

    } catch (err) {
      console.error("[ERROR] Failed to process request:", err);
    }
  });
}

main().catch(console.error);
