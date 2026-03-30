import { Octokit } from "@octokit/rest";

interface RepoInfo {
  name: string;
  description: string | null;
  cloneUrl: string;
  defaultBranch: string;
}

export async function getRepoInfo(
  token: string,
  org: string,
  repo: string,
): Promise<RepoInfo> {
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.repos.get({
    owner: org,
    repo,
  });

  return {
    name: data.name,
    description: data.description,
    cloneUrl: data.clone_url,
    defaultBranch: data.default_branch,
  };
}
