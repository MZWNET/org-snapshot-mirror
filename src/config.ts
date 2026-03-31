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

function parseRepoItem(item: string): { repoName: string; branchName?: string } | undefined {
  const trimmed = item.trim();
  if (!trimmed)
    return undefined;

  const lastColonIndex = trimmed.lastIndexOf(":");
  const lastSlashIndex = trimmed.lastIndexOf("/");
  if (lastColonIndex <= 0 || lastColonIndex < lastSlashIndex)
    return { repoName: trimmed };

  const candidateRepoName = trimmed.substring(0, lastColonIndex).trim();
  const candidateBranchName = trimmed.substring(lastColonIndex + 1).trim();

  if (candidateBranchName && !candidateRepoName.endsWith("/")) {
    return {
      repoName: candidateRepoName,
      branchName: candidateBranchName,
    };
  }

  return { repoName: trimmed };
}

export function getInputs(): ActionInputs {
  const sourceReposString = core.getInput("source_repos", { required: true });

  const parsedRepos = new Map<string, Set<string>>();
  for (const item of sourceReposString.split(",")) {
    const parsedItem = parseRepoItem(item);
    if (!parsedItem)
      continue;

    const { repoName, branchName } = parsedItem;
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
