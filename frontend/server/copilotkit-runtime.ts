// frontend/server/copilotkit-runtime.ts
// CopilotKit Runtime server - bridges GraphQL (frontend) to AG-UI (Python backend)
import "reflect-metadata";
import { createServer } from "node:http";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000";
const PORT = Number(process.env.RUNTIME_PORT || 4000);

const serviceAdapter = new ExperimentalEmptyAdapter();

const runtime = new CopilotRuntime({
  agents: {
    claude_code: new LangGraphHttpAgent({
      url: AGENT_URL,
    }),
  },
});

const handler = copilotRuntimeNodeHttpEndpoint({
  runtime,
  serviceAdapter,
  endpoint: "/copilotkit",
});

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url?.startsWith("/copilotkit")) {
    return handler(req, res);
  }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🔗 CopilotKit Runtime running on http://localhost:${PORT}`);
  console.log(`   Agent URL: ${AGENT_URL}`);
  console.log(`   Endpoint: /copilotkit`);
});
