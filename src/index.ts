import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import dotenv from "dotenv";
import { registerTools } from "./tools.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check route — Render.com uses this to know your server is alive
app.get("/", (req, res) => {
  res.send("Pharma R&D MCP Server is running! Tools: calculate_drug_dosage, check_excipient_compatibility, estimate_shelf_life, classify_adverse_event");
});

// MCP SSE endpoint — this is what ChatGPT connects to
app.get("/sse", async (req, res) => {
  const server = new McpServer({
    name: "my-mcp-server",
    version: "1.0.0",
  });

  registerTools(server);

  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

// MCP message endpoint — ChatGPT sends tool calls here
app.post("/messages", async (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});