import * as core from "@actions/core";

export interface RepoConfig {
  name: string;
  branches?: string[];
}

export interface ActionInputs {
  sourceOrg: string;
  sourceToken: string;
  sourceRepos: RepoConfig[];
  targetUrl: string;
  targetUsername: string;
  targetPassword: string;
  targetPlatform: "cnb" | "other";
  cnbApiToken?: string;
  cnbOrgPath?: string;
  maxParallel: number;
}

export function getInputs(): ActionInputs {
  const sourceReposString = core.getInput("source_repos", { required: true });

  const parsedRepos = new Map<string, Set<string>>();
  for (const item of sourceReposString.split(",")) {
    const trimmed = item.trim();
    if (!trimmed)
      continue;

    // We only want to split at the first colon to grab the repo name
    const colonIndex = trimmed.indexOf(":");
    let repoName = trimmed;
    let branchName: string | undefined;

    if (colonIndex !== -1) {
      repoName = trimmed.substring(0, colonIndex).trim();
      const bName = trimmed.substring(colonIndex + 1).trim();
      if (bName !== "") {
        branchName = bName;
      }
    }

    if (repoName === "")
      continue;

    if (!parsedRepos.has(repoName)) {
      parsedRepos.set(repoName, new Set<string>());
    }

    if (branchName !== undefined) {
      parsedRepos.get(repoName)!.add(branchName);
    }
  }

  const sourceRepos: RepoConfig[] = Array.from(parsedRepos.entries()).map(([name, branchesSet]) => ({
    name,
    branches: branchesSet.size > 0 ? Array.from(branchesSet) : undefined,
  }));

  if (sourceRepos.length === 0) {
    throw new TypeError("source_repos must contain at least one repository");
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
