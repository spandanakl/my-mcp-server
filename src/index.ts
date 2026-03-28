import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import dotenv from "dotenv";
import { registerTools } from "./tools.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANT — raw body needed before json parser for SSE post messages
app.use((req, res, next) => {
  if (req.path === "/messages") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Store active servers and transports by session ID
const sessions = new Map<string, {
  server: McpServer;
  transport: SSEServerTransport;
}>();

// Health check
app.get("/", (req: Request, res: Response) => {
  res.send("Pharma R&D MCP Server is running! Tools: calculate_drug_dosage, check_excipient_compatibility, estimate_shelf_life, classify_adverse_event");
});

// SSE endpoint — Inspector connects here first
app.get("/sse", async (req: Request, res: Response) => {
  console.log("New SSE connection request");

  // Set SSE headers manually
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  try {
    const server = new McpServer({
      name: "pharma-rd-mcp-server",
      version: "1.0.0",
    });

    registerTools(server);

    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;

    console.log(`Session created: ${sessionId}`);

    sessions.set(sessionId, { server, transport });

    req.on("close", () => {
      console.log(`Session closed: ${sessionId}`);
      sessions.delete(sessionId);
    });

    await server.connect(transport);
  } catch (error) {
    console.error("SSE error:", error);
  }
});

// Messages endpoint — Inspector sends tool calls here
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  console.log(`Incoming message for session: ${sessionId}`);

  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId" });
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    res.status(404).json({ error: "Session not found. Please reconnect." });
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Error handling message:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to handle message" });
    }
  }
});

// CORS preflight
app.options("*", (req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});