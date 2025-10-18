import { createServer } from 'http';
import { exec } from 'child_process';
import { URL } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Simple OAuth provider that uses hardcoded tokens from environment.
 * Falls back to interactive browser-based OAuth when tokens are missing.
 */
export class SimpleAuthProvider {
  constructor(serverUrl, accessToken, refreshToken) {
    this.serverUrl = serverUrl;
    this.tokensPath = join(process.cwd(), '.smithery', 'tokens.json');
    this.clientInfoPath = join(process.cwd(), '.smithery', 'client-info.json');
    this.authCodePromise = undefined;
    this.resolveAuthCode = undefined;
    this.rejectAuthCode = undefined;
    this.callbackServer = undefined;
    this.pendingAuthUrl = undefined;
    this._tokens = undefined;
    this._codeVerifier = undefined;
    this._clientInformation = undefined;

    if (accessToken) {
      this._tokens = {
        access_token: accessToken,
        token_type: 'Bearer',
        refresh_token: refreshToken,
      };
    } else {
      this.loadTokensFromDisk();
    }

    this.loadClientInfoFromDisk();
  }

  get redirectUrl() {
    return 'http://localhost:3737/callback';
  }

  get clientMetadata() {
    return {
      client_name: 'Consciousness Scraper',
      client_uri: 'https://github.com/consciousness-scraper',
      redirect_uris: [this.redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'read write',
      token_endpoint_auth_method: 'none',
    };
  }

  clientInformation() {
    return this._clientInformation;
  }

  async saveClientInformation(info) {
    this._clientInformation = info;
    this.persistClientInformation(info);
  }

  tokens() {
    return this._tokens;
  }

  async saveTokens(tokens) {
    this._tokens = tokens;
    this.persistTokens(tokens);
    console.log('✓ OAuth tokens saved for future sessions');
  }

  async redirectToAuthorization(url) {
    console.log('\n🔐 Authorization required. Launching Smithery login in your browser...');
    this.ensureAuthPromise();
    this.startCallbackServer();
    this.pendingAuthUrl = url.toString();
    const launcherUrl = this.buildLocalUrl('/launch');
    this.openBrowser(launcherUrl);
    console.log(`If the popup does not appear, open this URL manually:\n${launcherUrl.toString()}\n`);
    console.log('A small browser window will guide you through Smithery login and close automatically once complete.');
  }

  async saveCodeVerifier(verifier) {
    this._codeVerifier = verifier;
  }

  async codeVerifier() {
    if (!this._codeVerifier) {
      throw new Error('Code verifier not set');
    }
    return this._codeVerifier;
  }

  async waitForAuthorizationCode() {
    if (!this.authCodePromise) {
      throw new Error('Authorization has not been initiated');
    }

    return this.authCodePromise;
  }

  ensureAuthPromise() {
    if (!this.authCodePromise) {
      this.authCodePromise = new Promise((resolve, reject) => {
        this.resolveAuthCode = (code) => {
          resolve(code);
          this.cleanupAuthPromise();
        };
        this.rejectAuthCode = (error) => {
          reject(error);
          this.cleanupAuthPromise();
        };
      });
    }
  }

  cleanupAuthPromise() {
    this.authCodePromise = undefined;
    this.resolveAuthCode = undefined;
    this.rejectAuthCode = undefined;
  }

  startCallbackServer() {
    if (this.callbackServer) {
      return;
    }

    this.callbackServer = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400).end('Invalid request');
        return;
      }

      const requestUrl = new URL(req.url, this.redirectUrl);
      const path = requestUrl.pathname;

      if (path === '/launch') {
        const target = this.pendingAuthUrl || requestUrl.searchParams.get('target');
        if (!target) {
          res.writeHead(400, { 'Content-Type': 'text/plain' }).end('No authorization URL available');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head>
              <title>Smithery Login</title>
              <script>
                (function () {
                  const authUrl = ${JSON.stringify(target)};
                  try {
                    const popup = window.open(
                      authUrl,
                      'smithery-oauth',
                      'width=520,height=720,toolbar=no,menubar=no,location=no,status=no'
                    );
                    if (popup) {
                      popup.focus();
                    } else {
                      window.location.href = authUrl;
                      return;
                    }
                  } catch (error) {
                    console.error('Popup blocked:', error);
                    window.location.href = authUrl;
                    return;
                  }
                  setTimeout(() => window.close(), 500);
                })();
              </script>
              <noscript>
                <meta http-equiv="refresh" content="0; url=${target}">
              </noscript>
            </head>
            <body style="font-family: sans-serif; text-align: center; padding: 24px;">
              <p>Opening Smithery login…</p>
              <p>If nothing happens, <a href="${target}" target="_blank" rel="noreferrer noopener">click here</a>.</p>
            </body>
          </html>
        `);
        return;
      }

      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head>
              <title>Authorization complete</title>
              <script>
                window.addEventListener('load', () => {
                  if (window.opener) {
                    try {
                      window.opener.postMessage({ source: 'smithery-auth', status: 'success' }, '*');
                    } catch (err) {
                      console.warn('Unable to notify opener:', err);
                    }
                  }
                  setTimeout(() => window.close(), 150);
                });
              </script>
            </head>
            <body style="font-family: sans-serif; text-align: center; padding: 24px;">
              <h1>Authorization complete</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);

        if (this.resolveAuthCode) {
          this.resolveAuthCode(code);
        }
        this.pendingAuthUrl = undefined;
        this.closeCallbackServer();
      } else if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authorization failed</h1>
              <p>Error: ${error}</p>
            </body>
          </html>
        `);

        if (this.rejectAuthCode) {
          this.rejectAuthCode(new Error(`OAuth authorization failed: ${error}`));
        }
        this.pendingAuthUrl = undefined;
        this.closeCallbackServer();
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('No authorization code found.');
      }
    });

    this.callbackServer.on('error', (error) => {
      console.error(`❌ Failed to start OAuth callback server: ${error}`);
      if (this.rejectAuthCode) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.rejectAuthCode(err);
      }
      this.closeCallbackServer();
    });

    this.callbackServer.listen(3737, () => {
      console.log('📞 OAuth callback server listening on http://localhost:3737/callback');
    });
  }

  closeCallbackServer() {
    if (this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = undefined;
    }
  }

  openBrowser(url) {
    const urlString = url.toString();
    const command =
      process.platform === 'darwin'
        ? `open "${urlString}"`
        : process.platform === 'win32'
          ? `start "" "${urlString}"`
          : `xdg-open "${urlString}"`;

    exec(command, (error) => {
      if (error) {
        console.warn(`⚠️  Failed to auto-open browser: ${error.message}`);
        console.log(`Please open this URL manually: ${urlString}`);
      }
    });
  }

  buildLocalUrl(pathname) {
    const base = new URL(this.redirectUrl);
    base.pathname = pathname;
    base.search = '';
    base.hash = '';
    return base;
  }

  loadTokensFromDisk() {
    if (!existsSync(this.tokensPath)) {
      return;
    }

    try {
      const store = JSON.parse(readFileSync(this.tokensPath, 'utf-8'));
      const tokens = store[this.serverUrl];
      if (tokens) {
        this._tokens = tokens;
        console.log('🔐 Loaded saved OAuth tokens from disk');
      }
    } catch (error) {
      console.warn(`⚠️  Failed to read saved tokens: ${error}`);
    }
  }

  persistTokens(tokens) {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let store = {};

    if (existsSync(this.tokensPath)) {
      try {
        store = JSON.parse(readFileSync(this.tokensPath, 'utf-8'));
      } catch {
        store = {};
      }
    }

    store[this.serverUrl] = tokens;
    writeFileSync(this.tokensPath, JSON.stringify(store, null, 2));
  }

  loadClientInfoFromDisk() {
    if (!existsSync(this.clientInfoPath)) {
      return;
    }

    try {
      const store = JSON.parse(readFileSync(this.clientInfoPath, 'utf-8'));
      const info = store[this.serverUrl];
      if (info) {
        this._clientInformation = info;
        console.log('🪪 Loaded saved OAuth client registration');
      }
    } catch (error) {
      console.warn(`⚠️  Failed to read saved client info: ${error}`);
    }
  }

  persistClientInformation(info) {
    const dir = dirname(this.clientInfoPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let store = {};

    if (existsSync(this.clientInfoPath)) {
      try {
        store = JSON.parse(readFileSync(this.clientInfoPath, 'utf-8'));
      } catch {
        store = {};
      }
    }

    store[this.serverUrl] = info;
    writeFileSync(this.clientInfoPath, JSON.stringify(store, null, 2));
  }
}
