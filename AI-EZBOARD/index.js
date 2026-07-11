require("dotenv").config();
const puppeteer = require("puppeteer");
const { GoogleGenAI } = require("@google/genai");

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY is missing in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const ROOM_CODE = process.argv[2];
const BASE_URL = process.argv[3] || "http://localhost:5173";

if (!ROOM_CODE) {
  console.error("Usage: node index.js <ROOM_CODE> [BASE_URL]");
  process.exit(1);
}

const SYSTEM_PROMPT = `
You are an AI Collaborator in a collaborative whiteboard app called EzBoard (which uses Excalidraw).
You have the ability to read the current state of the whiteboard elements and modify or add new elements based on the user's instructions.
The user will provide you with the current Excalidraw elements as a JSON array, and their instruction.
You must output ONLY valid JSON containing the new or modified elements. Do NOT output markdown formatting like \`\`\`json. Just the raw JSON array.
When adding new elements, make sure to give them a random 8-character string "id", valid coordinates ("x", "y"), and valid dimensions.
Set "version" to 1 and "versionNonce" to a random number.
`;

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  
  // Set a specific name for the AI profile
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("ezboard-profile", JSON.stringify({ name: "AI Collaborator", accent: "#ff00ff" }));
  });

  const roomUrl = `${BASE_URL}/#/room/${ROOM_CODE}`;
  console.log(`Navigating to ${roomUrl}...`);
  await page.goto(roomUrl, { waitUntil: "networkidle2" });

  console.log("Connected to room. Waiting for chats...");

  await page.exposeFunction("onAIChatReceived", async (peerId, message) => {
    console.log(`Received prompt from user: "${message}"`);
    
    try {
      const elements = await page.evaluate(() => window.excalidrawAPI.getSceneElements());
      
      const prompt = `Current Elements:\n${JSON.stringify(elements)}\n\nUser Instruction: ${message}`;
      
      console.log("Asking Gemini...");
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
          { role: "user", parts: [{ text: prompt }] }
        ],
        config: { temperature: 0.2 }
      });
      
      let responseText = response.text;
      // Strip markdown code blocks if any
      if (responseText.startsWith("\`\`\`json")) {
        responseText = responseText.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
      } else if (responseText.startsWith("\`\`\`")) {
        responseText = responseText.replace(/\`\`\`/g, "").trim();
      }
      
      const newElements = JSON.parse(responseText);
      
      console.log(`Applying ${newElements.length} elements to board...`);
      await page.evaluate((newElementsStr) => {
        window.excalidrawAPI.updateScene({ elements: JSON.parse(newElementsStr), commitToHistory: false });
        
        // Also send a chat message back indicating completion
        // The room instance is on window? No, but we can emit a custom event to broadcast back
      }, JSON.stringify(newElements));

      // Wait, to send a chat message back, we need `roomRef.current?.sendAiChat`. 
      // The AI is a peer, so it doesn't need to broadcast back to itself, but it should tell others it's done.
      // But the WebApp currently only listens to `onAiChat` from peers!
      await page.evaluate(() => {
         // Find a way to trigger sendAiChat if possible, or just let the elements update visually speak for itself.
         console.log("Board updated.");
      });

    } catch (err) {
      console.error("Failed to process request:", err);
    }
  });
}

main().catch(console.error);
