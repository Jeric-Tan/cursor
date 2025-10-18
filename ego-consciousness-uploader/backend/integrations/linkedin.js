import { callTool } from './mcp-tools.js';

const TOOL_POST = process.env.LINKEDIN_TOOL_POST || 'linkedin_post';
const MCP_SERVER_URL = process.env.SMITHERY_SERVER_URL || null;

export async function handleLinkedInPost(req, res) {
  try {
    const {
      text,
      visibility = 'PUBLIC',
      media = [], // optional: [{ url, altText }]
      serverUrl = MCP_SERVER_URL,
    } = req.body || {};

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }

    const args = { text, visibility, media };
    const result = await callTool(TOOL_POST, args, serverUrl);
    return res.json({ ok: true, result });
  } catch (error) {
    console.error('[LinkedIn] Post failed:', error);
    return res.status(500).json({ error: 'Failed to create LinkedIn post' });
  }
}

