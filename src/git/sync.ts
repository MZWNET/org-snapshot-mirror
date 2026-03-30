import { buildAuthUrl, logWithPrefix } from "../utils.js";
import { execGit } from "./core.js";

export async function cloneMirror(
  sourceUrl: string,
  targetDir: string,
  logPrefix: string,
): Promise<void> {
  logWithPrefix(logPrefix, "Cloning mirror...");

  const result = await execGit(["clone", "--mirror", sourceUrl, targetDir], ".");

  if (result.exitCode !== 0) {
    throw new Error(`Failed to clone: ${result.stderr}`);
  }

  if (result.stderr) {
    logWithPrefix(logPrefix, result.stderr);
  }
}

export async function pushToTarget(
  repoDir: string,
  targetUrl: string,
  username: string,
  password: string,
  logPrefix: string,
): Promise<void> {
  logWithPrefix(logPrefix, "Pushing to target...");

  const authUrl = buildAuthUrl(targetUrl, username, password);

  // Add remote
  await execGit(["remote", "add", "target", authUrl], repoDir);

  // Configure LFS locksverify for this remote
  await execGit(["config", `lfs.${targetUrl}/info/lfs.locksverify`, "true"], repoDir);

  // Push branches
  const pushResult = await execGit(
    ["push", "target", "--force", "refs/heads/*:refs/heads/*", "refs/tags/*:refs/tags/*"],
    repoDir,
  );

  if (pushResult.exitCode !== 0) {
    throw new Error(`Failed to push: ${pushResult.stderr}`);
  }

  if (pushResult.stderr) {
    logWithPrefix(logPrefix, pushResult.stderr);
  }
}
