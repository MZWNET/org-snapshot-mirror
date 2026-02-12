import { Octokit } from "@octokit/rest";

export interface RepoInfo {
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

export async function listOrgRepos(
  token: string,
  org: string,
): Promise<RepoInfo[]> {
  const octokit = new Octokit({ auth: token });

  const repos: RepoInfo[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.repos.listForOrg,
    {
      org,
      per_page: 100,
    },
  )) {
    for (const repo of response.data) {
      repos.push({
        name: repo.name,
        description: repo.description ?? null,
        cloneUrl: repo.clone_url ?? "",
        defaultBranch: repo.default_branch ?? "main",
      });
    }
  }

  return repos;
}
