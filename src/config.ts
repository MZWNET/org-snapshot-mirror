import * as core from "@actions/core";

export interface ActionInputs {
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

export function getInputs(): ActionInputs {
  const sourceReposJson = core.getInput("source_repos", { required: true });
  const sourceRepos = JSON.parse(sourceReposJson) as string[];

  if (!Array.isArray(sourceRepos)) {
    throw new TypeError("source_repos must be a JSON array");
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
