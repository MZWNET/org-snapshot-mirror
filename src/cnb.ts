interface CreateRepoResponse {
  success: boolean;
  alreadyExists: boolean;
  error?: string;
}

export async function createCnbRepo(
  apiToken: string,
  orgPath: string,
  repoName: string,
  description: string | null,
): Promise<CreateRepoResponse> {
  const url = `https://api.cnb.cool/${orgPath}/-/repos`;

  const payload = {
    name: repoName,
    description: description || `Mirror of GitHub repo ${repoName}`,
    visibility: "public",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true, alreadyExists: false };
    }

    if (response.status === 409) {
      return { success: true, alreadyExists: true };
    }

    const body = await response.text();
    return {
      success: false,
      alreadyExists: false,
      error: `HTTP ${response.status}: ${body}`,
    };
  }
  catch (error) {
    return {
      success: false,
      alreadyExists: false,
      error: String(error),
    };
  }
}
