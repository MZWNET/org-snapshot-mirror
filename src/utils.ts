import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as core from "@actions/core";

export async function createTempDir(prefix: string): Promise<string> {
  const tmpBase = os.tmpdir();
  const dir = await fs.mkdtemp(path.join(tmpBase, `${prefix}-`));
  return dir;
}

export async function cleanupDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  }
  catch (error) {
    core.warning(`Failed to cleanup directory ${dir}: ${error}`);
  }
}

export function logWithPrefix(prefix: string, message: string): void {
  const lines = message.split("\n");
  for (const line of lines) {
    if (line.trim()) {
      core.info(`[${prefix}] ${line}`);
    }
  }
}

export function errorWithPrefix(prefix: string, message: string): void {
  core.error(`[${prefix}] ${message}`);
}

export function buildAuthUrl(
  baseUrl: string,
  username: string,
  password: string,
): string {
  const url = new URL(baseUrl);
  url.username = encodeURIComponent(username);
  url.password = encodeURIComponent(password);
  return url.toString();
}
