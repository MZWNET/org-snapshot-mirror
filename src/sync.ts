import type { ActionInputs, RepoConfig } from "./config.js";
import { fetchLfs, pushLfs } from "./git/lfs.js";
import { createSnapshotCommits } from "./git/snapshot.js";
import { cloneMirror, pushToTarget } from "./git/sync.js";
import { createCnbRepo } from "./services/cnb.js";
import { getRepoInfo } from "./services/github.js";
import {
  cleanupDir,
  createTempDir,
  errorWithPrefix,
  logWithPrefix,
} from "./utils.js";

export async function syncRepo(
  repo: RepoConfig,
  inputs: ActionInputs,
): Promise<{ success: boolean; error?: string }> {
  const repoName = repo.name;
  const logPrefix = repoName;
  let tempDir: string | null = null;

  try {
    // Get repo info from GitHub
    logWithPrefix(logPrefix, "Fetching repo info from GitHub...");
    const repoInfo = await getRepoInfo(
      inputs.sourceToken,
      inputs.sourceOrg,
      repoName,
    );

    // Determine the branches to sync
    const branchesToSync = repo.branches && repo.branches.length > 0
      ? repo.branches
      : [repoInfo.defaultBranch];

    logWithPrefix(logPrefix, `Branches to sync: ${branchesToSync.join(", ")}`);

    // Create repo on CNB if needed
    if (inputs.targetPlatform === "cnb") {
      if (inputs.cnbApiToken === undefined || inputs.cnbOrgPath === undefined) {
        throw new Error(
          "cnb_api_token and cnb_org_path are required for CNB platform",
        );
      }

      logWithPrefix(logPrefix, "Creating repo on CNB...");
      const createResult = await createCnbRepo(
        inputs.cnbApiToken,
        inputs.cnbOrgPath,
        repoName,
        repoInfo.description,
      );

      if (!createResult.success) {
        throw new Error(`Failed to create CNB repo: ${createResult.error}`);
      }

      if (createResult.alreadyExists) {
        logWithPrefix(logPrefix, "Repo already exists on CNB");
      }
      else {
        logWithPrefix(logPrefix, "Repo created on CNB");
      }
    }

    // Create temp directory
    tempDir = await createTempDir(`sync-${repoName}`);
    const repoDir = `${tempDir}/repo.git`;

    // Clone mirror
    const sourceUrl = `https://${inputs.sourceToken}@github.com/${inputs.sourceOrg}/${repoName}.git`;
    await cloneMirror(sourceUrl, repoDir, logPrefix);

    // Fetch LFS
    await fetchLfs(repoDir, sourceUrl, logPrefix);

    // Create snapshot commits
    await createSnapshotCommits(repoDir, branchesToSync, logPrefix);

    // Build target URL
    let targetRepoUrl = inputs.targetUrl;
    if (!targetRepoUrl.endsWith("/")) {
      targetRepoUrl += "/";
    }
    targetRepoUrl += `${repoName}.git`;

    // Push to target
    await pushToTarget(
      repoDir,
      targetRepoUrl,
      inputs.targetUsername,
      inputs.targetPassword,
      branchesToSync,
      logPrefix,
    );

    // Push LFS
    await pushLfs(repoDir, logPrefix);

    logWithPrefix(logPrefix, "Sync completed successfully");
    return { success: true };
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errorWithPrefix(logPrefix, `Sync failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
  finally {
    if (tempDir !== null) {
      await cleanupDir(tempDir);
    }
  }
}
