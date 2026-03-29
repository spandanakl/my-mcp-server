import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import dotenv from "dotenv";
import { registerTools } from "./tools.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Store active transports by session ID
const transports = new Map<string, SSEServerTransport>();

// Health check — no middleware needed
app.get("/", (req: Request, res: Response) => {
  res.send("Pharma R&D MCP Server is running! Tools: calculate_drug_dosage, check_excipient_compatibility, estimate_shelf_life, classify_adverse_event");
});

// SSE endpoint
app.get("/sse", async (req: Request, res: Response) => {
  console.log("New SSE connection");

  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  transports.set(sessionId, transport);

  console.log(`Session created: ${sessionId}`);

  req.on("close", () => {
    console.log(`Session closed: ${sessionId}`);
    transports.delete(sessionId);
  });

  const server = new McpServer({
    name: "pharma-rd-mcp-server",
    version: "1.0.0",
  });

  registerTools(server);

  await server.connect(transport);
});

// Messages endpoint — NO json middleware here, let SDK handle raw body
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  console.log(`Message for session: ${sessionId}`);

  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId" });
    return;
  }

  const transport = transports.get(sessionId);

  if (!transport) {
    console.error(`Session not found: ${sessionId}`);
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});