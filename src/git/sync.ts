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

export async function getDefaultBranchFromMirror(
  repoDir: string,
  logPrefix: string,
): Promise<string> {
  logWithPrefix(logPrefix, "Detecting default branch from mirrored repo...");

  const result = await execGit(["symbolic-ref", "HEAD"], repoDir);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to detect default branch: ${result.stderr}`);
  }

  return result.stdout.trim().replace(/^refs\/heads\//, "");
}

export async function pushToTarget(
  repoDir: string,
  targetUrl: string,
  username: string,
  password: string,
  branchesToSync: string[],
  logPrefix: string,
): Promise<void> {
  logWithPrefix(logPrefix, "Pushing to target...");

  const authUrl = buildAuthUrl(targetUrl, username, password);

  // Add remote
  await execGit(["remote", "add", "target", authUrl], repoDir);

  // Configure LFS locksverify for this remote
  await execGit(["config", `lfs.${targetUrl}/info/lfs.locksverify`, "true"], repoDir);

  if (branchesToSync.length === 0) {
    logWithPrefix(logPrefix, "No branches to push");
    return;
  }

  // Push branches
  const pushArgs = ["push", "target", "--force"];
  for (const branch of branchesToSync) {
    pushArgs.push(`refs/heads/${branch}:refs/heads/${branch}`);
  }
  pushArgs.push("refs/tags/*:refs/tags/*");

  const pushResult = await execGit(pushArgs, repoDir);

  if (pushResult.exitCode !== 0) {
    throw new Error(`Failed to push: ${pushResult.stderr}`);
  }

  if (pushResult.stderr) {
    logWithPrefix(logPrefix, pushResult.stderr);
  }
}
