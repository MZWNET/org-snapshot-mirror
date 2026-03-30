import * as core from "@actions/core";
import { logWithPrefix } from "../utils.js";
import { execGit } from "./core.js";

export async function fetchLfs(
  repoDir: string,
  sourceUrl: string,
  logPrefix: string,
): Promise<void> {
  logWithPrefix(logPrefix, "Fetching LFS objects...");

  const result = await execGit(["lfs", "fetch", "--all", sourceUrl], repoDir);

  if (result.exitCode !== 0) {
    core.warning(`[${logPrefix}] LFS fetch warning: ${result.stderr}`);
  }
  else if (result.stderr) {
    logWithPrefix(logPrefix, result.stderr);
  }
}

export async function pushLfs(
  repoDir: string,
  logPrefix: string,
): Promise<void> {
  logWithPrefix(logPrefix, "Pushing LFS objects...");

  const result = await execGit(["lfs", "push", "--all", "target"], repoDir);

  if (result.exitCode !== 0) {
    core.warning(`[${logPrefix}] LFS push warning: ${result.stderr}`);
  }
  else if (result.stderr) {
    logWithPrefix(logPrefix, result.stderr);
  }
}

export async function installLfs(): Promise<void> {
  const installResult = await execGit(["lfs", "install"], ".");
  if (installResult.exitCode !== 0) {
    core.warning(`LFS install warning: ${installResult.stderr}`);
  }

  const configResult = await execGit(["config", "--global", "lfs.locksverify", "true"], ".");
  if (configResult.exitCode !== 0) {
    core.warning(`LFS config warning: ${configResult.stderr}`);
  }
}
