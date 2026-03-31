import type { ActionInputs, RepoConfig } from "./config.js";
import { fetchLfs, pushLfs } from "./git/lfs.js";
import { createSnapshotCommits } from "./git/snapshot.js";
import { cloneMirror, getDefaultBranchFromMirror, pushToTarget } from "./git/sync.js";
import { createCnbRepo } from "./services/cnb.js";
import { getRepoInfo } from "./services/github.js";
import {
  cleanupDir,
  createTempDir,
  errorWithPrefix,
  logWithPrefix,
} from "./utils.js";

interface ResolvedSourceRepo {
  sourceUrl: string;
  githubOwner?: string;
  githubRepo?: string;
  targetRepoName: string;
  usesGitHubApi: boolean;
}

function isRepoUrl(repoName: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(repoName);
}

function isOwnerRepo(repoName: string): boolean {
  return /^[^/]+\/[^/]+$/.test(repoName);
}

function stripGitSuffix(value: string): string {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

function getTargetRepoName(repoName: string): string {
  if (isRepoUrl(repoName)) {
    const url = new URL(repoName);
    const segments = url.pathname.split("/").filter(Boolean);
    const lastSegment = segments.at(-1);
    if (lastSegment === undefined || lastSegment === "") {
      throw new Error(`Unable to determine repo name from URL: ${repoName}`);
    }
    return stripGitSuffix(lastSegment);
  }

  if (isOwnerRepo(repoName)) {
    return stripGitSuffix(repoName.split("/")[1]);
  }

  return stripGitSuffix(repoName);
}

function ensureGitSuffix(repoUrl: string): string {
  return repoUrl.endsWith(".git") ? repoUrl : `${repoUrl}.git`;
}

function sanitizeTempPrefix(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function resolveSourceRepo(
  repoName: string,
  inputs: ActionInputs,
): ResolvedSourceRepo {
  if (isRepoUrl(repoName)) {
    return {
      sourceUrl: ensureGitSuffix(repoName),
      targetRepoName: getTargetRepoName(repoName),
      usesGitHubApi: false,
    };
  }

  if (isOwnerRepo(repoName)) {
    const [githubOwner, githubRepo] = repoName.split("/", 2);
    return {
      sourceUrl: `https://${inputs.sourceToken}@github.com/${githubOwner}/${githubRepo}.git`,
      githubOwner,
      githubRepo: stripGitSuffix(githubRepo),
      targetRepoName: stripGitSuffix(githubRepo),
      usesGitHubApi: true,
    };
  }

  return {
    sourceUrl: `https://${inputs.sourceToken}@github.com/${inputs.sourceOrg}/${repoName}.git`,
    githubOwner: inputs.sourceOrg,
    githubRepo: stripGitSuffix(repoName),
    targetRepoName: stripGitSuffix(repoName),
    usesGitHubApi: true,
  };
}

export async function syncRepo(
  repo: RepoConfig,
  inputs: ActionInputs,
): Promise<{ success: boolean; error?: string }> {
  const sourceRepoName = repo.name;
  const logPrefix = sourceRepoName;
  const resolvedSource = resolveSourceRepo(sourceRepoName, inputs);
  let tempDir: string | null = null;

  try {
    let description: string | null = null;
    let defaultBranch: string | undefined;

    if (resolvedSource.usesGitHubApi) {
      logWithPrefix(logPrefix, "Fetching repo info from GitHub...");
      const repoInfo = await getRepoInfo(
        inputs.sourceToken,
        resolvedSource.githubOwner!,
        resolvedSource.githubRepo!,
      );
      description = repoInfo.description;
      defaultBranch = repoInfo.defaultBranch;
    }
    else {
      logWithPrefix(logPrefix, "Skipping GitHub API lookup for URL source repo");
      description = "111";
    }

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
        resolvedSource.targetRepoName,
        description,
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
    tempDir = await createTempDir(`sync-${sanitizeTempPrefix(resolvedSource.targetRepoName)}`);
    const repoDir = `${tempDir}/repo.git`;

    // Clone mirror
    await cloneMirror(resolvedSource.sourceUrl, repoDir, logPrefix);

    const branchesToSync = repo.branches && repo.branches.length > 0
      ? repo.branches
      : [defaultBranch ?? await getDefaultBranchFromMirror(repoDir, logPrefix)];

    logWithPrefix(logPrefix, `Branches to sync: ${branchesToSync.join(", ")}`);

    // Fetch LFS
    await fetchLfs(repoDir, resolvedSource.sourceUrl, logPrefix);

    // Create snapshot commits
    await createSnapshotCommits(repoDir, branchesToSync, logPrefix);

    // Build target URL
    let targetRepoUrl = inputs.targetUrl;
    if (!targetRepoUrl.endsWith("/")) {
      targetRepoUrl += "/";
    }
    targetRepoUrl += `${resolvedSource.targetRepoName}.git`;

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
