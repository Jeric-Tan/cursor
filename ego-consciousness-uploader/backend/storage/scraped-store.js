import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCRAPED_ROOT = join(__dirname, '..', '..', 'data', 'scraped');

async function ensureDir() {
  await fs.mkdir(SCRAPED_ROOT, { recursive: true });
}

export async function saveScrapedSnapshot(sessionId, payload) {
  await ensureDir();
  const filePath = join(SCRAPED_ROOT, `${sessionId}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return filePath;
}
