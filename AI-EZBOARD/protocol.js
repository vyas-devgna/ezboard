const { randomUUID } = require("node:crypto");

function createAgentRequest(peerId, message, elements) {
  const safeMessage = String(message).trim().slice(0, 4000);
  return {
    protocol: "ezboard.agent.v1",
    requestId: randomUUID(),
    input: { peerId, message: safeMessage, elements: Array.isArray(elements) ? elements.slice(0, 5000) : [] },
    task: "Reason about the request and return the smallest clear, well-spaced diagram that satisfies it.",
    outputContract: {
      format: "JSON: { requestId, message, elements }",
      elementRules: "elements must be valid Excalidraw elements with unique ids, finite coordinates, and version fields",
      drawingRules: [
        "Prefer labelled shapes and arrows over decoration",
        "Avoid overlaps; keep consistent spacing, alignment, colors, and hierarchy",
        "Preserve existing elements unless the user explicitly asks to replace them",
      ],
    },
  };
}

function parseAgentResponse(line) {
  const value = JSON.parse(line);
  if (!value || typeof value !== "object" || !Array.isArray(value.elements)) {
    throw new Error("Agent response elements must be an array");
  }
  if (value.elements.length > 5000 || value.elements.some((element) =>
    !element || typeof element !== "object" || typeof element.id !== "string" ||
    typeof element.type !== "string" || !Number.isFinite(element.x) || !Number.isFinite(element.y))) {
    throw new Error("Agent response contains invalid Excalidraw elements");
  }
  return {
    requestId: typeof value.requestId === "string" ? value.requestId : "",
    message: typeof value.message === "string" ? value.message : "",
    elements: value.elements,
  };
}

module.exports = { createAgentRequest, parseAgentResponse };
