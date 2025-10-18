// Generic helper to call Smithery MCP tools using the existing MCP client
import { ExaMCPClient } from '../scraper/mcp-client.js';
import { config } from '../scraper/config.js';

export async function withMCP(serverUrl, fn) {
  const prevUrl = config.smitheryServerUrl;
  if (serverUrl) {
    config.smitheryServerUrl = serverUrl;
  }
  const client = new ExaMCPClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.disconnect();
    // restore
    config.smitheryServerUrl = prevUrl;
  }
}

export async function callTool(toolName, args = {}, serverUrl) {
  return withMCP(serverUrl, async (client) => {
    const result = await client.client.callTool({ name: toolName, arguments: args });
    return client.parseToolResult(result);
  });
}

