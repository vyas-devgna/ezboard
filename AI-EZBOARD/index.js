const puppeteer = require("puppeteer");
const readline = require("node:readline");
const { createAgentRequest, parseAgentResponse } = require("./protocol");

const BASE_URL = process.argv[3] || "https://ezboard.vyasdevgna.online";
const RESPONSE_TIMEOUT_MS = 120_000;
const pending = new Map();

function roomCode(value) {
  if (!value || value === "--auto") {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 5 || /[ILO01]/.test(code)) throw new Error("Room code must be 5 characters and exclude I, L, O, 0, and 1");
  return code;
}

function waitForAgent(request) {
  process.stdout.write(`${JSON.stringify(request)}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(request.requestId);
      reject(new Error("Agent response timed out"));
    }, RESPONSE_TIMEOUT_MS);
    pending.set(request.requestId, { resolve, timer });
  });
}

function acceptResponse(line) {
  const response = parseAgentResponse(line);
  const id = response.requestId || pending.keys().next().value;
  const request = pending.get(id);
  if (!request) throw new Error(`Unknown requestId: ${id || "missing"}`);
  clearTimeout(request.timer);
  pending.delete(id);
  request.resolve(response);
}

function listenForResponses() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  let legacy = "";
  let readingLegacy = false;
  rl.on("line", (line) => {
    try {
      if (line.trim() === "=== EZBOARD_REPLY_START ===") { readingLegacy = true; legacy = ""; return; }
      if (line.trim() === "=== EZBOARD_REPLY_END ===") { readingLegacy = false; acceptResponse(legacy); return; }
      if (readingLegacy) { legacy += line; return; }
      if (line.trim()) acceptResponse(line);
    } catch (error) {
      console.error(`[agent] ${error.message}`);
    }
  });
}

async function main() {
  const code = roomCode(process.argv[2]);
  listenForResponses();
  console.error(`[ezboard] room ${code}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: process.env.EZBOARD_NO_SANDBOX === "1" ? ["--no-sandbox"] : [],
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => localStorage.setItem("ezboard.profile.v1", JSON.stringify({
    actorId: "ai-agent", name: "AI Agent", accent: "#6054ee",
  })));

  await page.exposeFunction("onAIChatReceived", async (peerId, message) => {
    try {
      const elements = await page.evaluate(() => window.excalidrawAPI?.getSceneElements() ?? []);
      const response = await waitForAgent(createAgentRequest(peerId, message, elements));
      if (response.message) await page.evaluate((text) => window.sendAiChat?.(text), response.message);
      if (!response.elements.length) return;
      await page.evaluate((next) => {
        const api = window.excalidrawAPI;
        if (!api) throw new Error("Excalidraw API unavailable");
        api.updateScene({ elements: [...api.getSceneElementsIncludingDeleted(), ...next], commitToHistory: true });
        api.scrollToContent(next, { fitToContent: true });
      }, response.elements);
    } catch (error) {
      console.error(`[ezboard] ${error.message}`);
      await page.evaluate((text) => window.sendAiChat?.(text), `AI request failed: ${error.message}`);
    }
  });

  await page.goto(`${BASE_URL}/#/room/${code}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForFunction(() => Boolean(window.excalidrawAPI), { timeout: 30_000 });
  console.error("[ezboard] connected; read JSON requests from stdout and write JSON responses to stdin");

  const shutdown = async () => { await browser.close(); process.exit(0); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });

module.exports = { roomCode, acceptResponse };
