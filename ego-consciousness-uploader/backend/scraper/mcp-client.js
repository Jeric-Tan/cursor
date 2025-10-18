import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { config } from './config.js';
import { SimpleAuthProvider } from './simple-auth-provider.js';

/**
 * MCP Client for connecting to Exa via Smithery.
 */
export class ExaMCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.authProvider = null;
    this.toolNames = new Set();
  }

  async connect() {
    try {
      const authProvider = new SimpleAuthProvider(
        config.smitheryServerUrl,
        config.oauthAccessToken,
        config.oauthRefreshToken,
      );
      this.authProvider = authProvider;

      this.client = new Client(
        {
          name: 'consciousness-scraper',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );

      while (true) {
        try {
          if (!this.transport) {
            this.transport = new StreamableHTTPClientTransport(
              new URL(config.smitheryServerUrl),
              { authProvider },
            );
          }

          await this.client.connect(this.transport);
          console.log('✓ Connected to Exa MCP server via Smithery');
          await this.refreshToolCache();
          break;
        } catch (error) {
          if (error instanceof UnauthorizedError && this.transport && this.authProvider) {
            console.log('🔐 Completing Smithery OAuth flow...');
            try {
              const authCode = await this.authProvider.waitForAuthorizationCode();
              await this.transport.finishAuth(authCode);
              console.log('🔁 Retrying connection with fresh tokens...');
              // Recreate transport for a clean reconnection attempt
              this.transport = null;
              continue;
            } catch (authError) {
              throw new Error(`OAuth authorization failed: ${authError}`);
            }
          } else if (error && typeof error === 'object' && error !== null && error.name === 'UnauthorizedError') {
            // Re-throw unauthorized errors that are not instances (defensive for ESM interop)
            throw new Error(`Unauthorized: ${error.message || error}`);
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to connect to Exa MCP server: ${error}`);
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
      }
    } catch {
      // Ignore disconnect errors.
    } finally {
      this.client = null;
      this.transport = null;
    }
  }

  async listTools() {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.listTools();
    this.toolNames = new Set(result.tools.map((tool) => tool.name));
    return result.tools;
  }

  supportsTool(name) {
    return this.toolNames.has(name);
  }

  async refreshToolCache() {
    if (!this.client) {
      return;
    }

    try {
      const result = await this.client.listTools();
      this.toolNames = new Set(result.tools.map((tool) => tool.name));
    } catch (error) {
      console.warn(`⚠️  Could not refresh tool list: ${error}`);
    }
  }

  async webSearch(query, numResults = 10) {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.callTool({
      name: 'web_search_exa',
      arguments: {
        query,
        numResults,
        text: true,
      },
    });

    return this.parseToolResult(result);
  }

  async getContents(urls) {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.callTool({
      name: 'get_contents_exa',
      arguments: {
        ids: urls,
      },
    });

    return this.parseToolResult(result);
  }

  async findSimilar(url, numResults = 10) {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.callTool({
      name: 'find_similar_exa',
      arguments: {
        url,
        numResults,
      },
    });

    return this.parseToolResult(result);
  }

  parseToolResult(result) {
    if (!result.content || result.content.length === 0) {
      return [];
    }

    const results = [];

    for (const item of result.content) {
      if (item.type === 'text') {
        try {
          const parsed = JSON.parse(item.text);
          if (Array.isArray(parsed)) {
            results.push(...parsed);
          } else if (parsed && Array.isArray(parsed.results)) {
            results.push(...parsed.results);
          } else if (parsed) {
            results.push(parsed);
          }
        } catch {
          console.warn('Could not parse tool result item as JSON');
        }
      }
    }

    return results;
  }
}
