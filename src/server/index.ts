import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { EXTENSION_ID } from "../shared/extension-id.js";
import { VERSION } from "../shared/version.js";
import { createBridge } from "./bridge.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./tools.js";

const config = loadConfig();
const bridge = createBridge({ port: config.port, token: config.token, extensionId: EXTENSION_ID });

const server = new McpServer({ name: "ai-browser-agent", version: VERSION });
registerTools(server, bridge.send);

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await bridge.close().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.stdin.on("close", shutdown);

await server.connect(new StdioServerTransport());
process.stderr.write(`[ai-browser] MCP server ready. Token file: ${config.home}/token\n`);
void bridge.start();
