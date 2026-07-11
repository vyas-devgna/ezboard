---
name: ezboard-agent
description: Connect any AI agent to an EzBoard room and create or modify high-quality Excalidraw diagrams. Use for EzBoard AI collaboration, diagram generation, system architecture drawings, flowcharts, wireframes, mind maps, or responding to the ezboard.agent.v1 NDJSON protocol.
---

# EzBoard Agent

Run `npm install` once in `AI-EZBOARD`, then start the bridge from the repository root:

```bash
node AI-EZBOARD/index.js ROOM_CODE
```

Read one `ezboard.agent.v1` JSON request per line from stdout. Write exactly one JSON response per line to stdin:

```json
{"requestId":"copy-from-request","message":"Short user-facing summary","elements":[]}
```

## Drawing workflow

1. Read the request, existing scene, task, and output contract.
2. Infer the diagram type, hierarchy, and main reading direction.
3. Reuse existing elements when modifying a scene; add only what is needed.
4. Lay out elements on a consistent grid with whitespace and no overlaps.
5. Use labelled shapes, restrained colors, and bound arrows that make causality obvious.
6. Return complete valid Excalidraw elements with unique IDs, finite coordinates, dimensions, versions, and nonces.
7. Copy `requestId` exactly so concurrent requests are routed correctly.

Keep the response machine-readable. Do not wrap JSON in Markdown or print commentary to stdout.

For a detached bridge, set `EZBOARD_RESPONSE_FILE` to an append-only NDJSON file; the bridge watches it for responses while requests continue on stdout.
