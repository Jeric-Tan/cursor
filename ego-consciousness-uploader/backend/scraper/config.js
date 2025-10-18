import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  smitheryServerUrl:
    process.env.SMITHERY_SERVER_URL || 'https://server.smithery.ai/exa/mcp',
  oauthAccessToken:
    process.env.OAUTH_ACCESS_TOKEN || process.env.SMITHERY_OAUTH_ACCESS_TOKEN,
  oauthRefreshToken:
    process.env.OAUTH_REFRESH_TOKEN || process.env.SMITHERY_OAUTH_REFRESH_TOKEN,
  outputDir: process.env.OUTPUT_DIR || 'output',
  rootDir: join(__dirname, '..'),
};

export function validateConfig() {
  console.log(`📡 Using Smithery MCP server: ${config.smitheryServerUrl}`);
  if (config.oauthAccessToken) {
    console.log(`🔑 Using OAuth tokens from environment\n`);
  } else {
    console.log(`⚠️  No OAuth tokens configured - OAuth flow may be required\n`);
  }
}
