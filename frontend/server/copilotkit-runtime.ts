// frontend/server/copilotkit-runtime.ts
// CopilotKit Runtime server - bridges GraphQL (frontend) to AG-UI (Python backend)
import "reflect-metadata";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync, existsSync } from "node:fs";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000";
const PORT = Number(process.env.RUNTIME_PORT || 4000);
const SSL_KEYFILE = process.env.SSL_KEYFILE;
const SSL_CERTFILE = process.env.SSL_CERTFILE;

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

const requestHandler = async (req: any, res: any) => {
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
};

// Use HTTPS if cert files are provided, otherwise HTTP
const useSSL =
  SSL_KEYFILE && SSL_CERTFILE &&
  existsSync(SSL_KEYFILE) && existsSync(SSL_CERTFILE);

const server = useSSL
  ? createHttpsServer(
      { key: readFileSync(SSL_KEYFILE!), cert: readFileSync(SSL_CERTFILE!) },
      requestHandler,
    )
  : createHttpServer(requestHandler);

const protocol = useSSL ? "https" : "http";

server.listen(PORT, () => {
  console.log(`🔗 CopilotKit Runtime running on ${protocol}://localhost:${PORT}`);
  console.log(`   Agent URL: ${AGENT_URL}`);
  console.log(`   Endpoint: /copilotkit`);
  if (useSSL) console.log(`   SSL: enabled`);
});
