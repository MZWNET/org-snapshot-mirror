import * as core from "@actions/core";
import pLimit from "p-limit";

import { getInputs } from "./config.js";
import { installLfs } from "./git/lfs.js";
import { syncRepo } from "./sync.js";

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
      inputs.sourceRepos.map(async repoName =>
        limit(async () => syncRepo(repoName, inputs)),
      ),
    );

    // Summary
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    core.info(`\nSync completed: ${succeeded} succeeded, ${failed} failed`);

    if (failed > 0) {
      core.info("\nFailed repos:");
      for (let i = 0; i < results.length; i++) {
        if (!results[i].success) {
          core.error(`  - ${inputs.sourceRepos[i]}: ${results[i].error}`);
        }
      }
      core.setFailed(`Failed to sync ${failed} repos`);
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${errorMessage}`);
  }
}

void run();
