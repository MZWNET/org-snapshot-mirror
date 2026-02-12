import * as core from "@actions/core";
import pLimit from "p-limit";
import { parse as parseYaml } from "yaml";

import { createCnbRepo } from "./cnb.js";
import {
  cloneMirror,
  createSnapshotCommits,
  fetchLfs,
  installLfs,
  pushLfs,
  pushToTarget,
} from "./git.js";
import { getRepoInfo } from "./github.js";
import {
  cleanupDir,
  createTempDir,
  errorWithPrefix,
  logWithPrefix,
} from "./utils.js";

interface ActionInputs {
  sourceOrg: string;
  sourceToken: string;
  sourceRepos: string[];
  targetUrl: string;
  targetUsername: string;
  targetPassword: string;
  targetPlatform: "cnb" | "other";
  cnbApiToken?: string;
  cnbOrgPath?: string;
  maxParallel: number;
}

function getInputs(): ActionInputs {
  const sourceReposYaml = core.getInput("source_repos", { required: true });
  const sourceRepos = parseYaml(sourceReposYaml) as string[];

  if (!Array.isArray(sourceRepos)) {
    throw new TypeError("source_repos must be a YAML array");
  }

  const targetPlatform = core.getInput("target_platform") || "other";
  if (targetPlatform !== "cnb" && targetPlatform !== "other") {
    throw new Error("target_platform must be 'cnb' or 'other'");
  }

  return {
    sourceOrg: core.getInput("source_org", { required: true }),
    sourceToken: core.getInput("source_token", { required: true }),
    sourceRepos,
    targetUrl: core.getInput("target_url", { required: true }),
    targetUsername: core.getInput("target_username", { required: true }),
    targetPassword: core.getInput("target_password", { required: true }),
    targetPlatform,
    cnbApiToken: core.getInput("cnb_api_token") || undefined,
    cnbOrgPath: core.getInput("cnb_org_path") || undefined,
    maxParallel: Number.parseInt(core.getInput("max_parallel") || "4", 10),
  };
}

async function syncRepo(
  repoName: string,
  inputs: ActionInputs,
): Promise<{ success: boolean; error?: string }> {
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

    // Create repo on CNB if needed
    if (inputs.targetPlatform === "cnb") {
      if (!inputs.cnbApiToken || !inputs.cnbOrgPath) {
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
    await createSnapshotCommits(repoDir, logPrefix);

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
    if (tempDir) {
      await cleanupDir(tempDir);
    }
  }
}

async function run(): Promise<void> {
  try {
    const inputs = getInputs();

    core.info(`Starting sync for ${inputs.sourceRepos.length} repos`);
    core.info(`Source org: ${inputs.sourceOrg}`);
    core.info(`Target platform: ${inputs.targetPlatform}`);
    core.info(`Max parallel: ${inputs.maxParallel}`);

    // Install LFS
    await installLfs();

    // Create limiter for parallel execution
    const limit = pLimit(inputs.maxParallel);

    // Sync all repos in parallel (with limit)
    const results = await Promise.all(
      inputs.sourceRepos.map(repoName =>
        limit(() => syncRepo(repoName, inputs)),
      ),
    );

    // Summary
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    core.info(`\nSync completed: ${succeeded} succeeded, ${failed} failed`);

    if (failed > 0) {
      const failedRepos = inputs.sourceRepos.filter(
        (_, i) => !results[i].success,
      );
      core.setFailed(`Failed to sync repos: ${failedRepos.join(", ")}`);
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${errorMessage}`);
  }
}

run();
