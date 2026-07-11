const assert = require("node:assert/strict");
const { createAgentRequest, parseAgentResponse } = require("./protocol");

const request = createAgentRequest("peer-1", "Draw a resilient API", []);
assert.equal(request.protocol, "ezboard.agent.v1");
assert.equal(request.input.message, "Draw a resilient API");
assert.ok(request.outputContract.elementRules.includes("valid Excalidraw elements"));

assert.deepEqual(
  parseAgentResponse(JSON.stringify({ requestId: request.requestId, message: "Done", elements: [] })),
  { requestId: request.requestId, message: "Done", elements: [] },
);
assert.throws(() => parseAgentResponse('{"elements":"bad"}'), /elements/);
assert.throws(() => parseAgentResponse('{"elements":[{"id":"x","type":"rectangle","x":null,"y":0}]}'), /invalid/);

console.log("AI protocol checks passed");
