import { Octokit } from "@octokit/rest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRepoInfo } from "./github.js";

vi.mock("@octokit/rest", () => {
  const mockGet = vi.fn();
  return {
    Octokit: class MockOctokit {
      repos = {
        get: mockGet,
      };
    },
  };
});

describe("services/github", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRepoInfo", () => {
    it("should return correct repo details", async () => {
      const mockOctokitInstance = new Octokit();
      const mockGet = mockOctokitInstance.repos.get as unknown as ReturnType<typeof vi.fn>;

      mockGet.mockResolvedValue({
        data: {
          name: "test-repo",
          description: "A test repository",
          clone_url: "https://github.com/org/test-repo.git",
          default_branch: "main",
        },
      });

      const info = await getRepoInfo("test-token", "org", "test-repo");

      expect(mockGet).toHaveBeenCalledWith({ owner: "org", repo: "test-repo" });
      expect(info).toEqual({
        name: "test-repo",
        description: "A test repository",
        cloneUrl: "https://github.com/org/test-repo.git",
        defaultBranch: "main",
      });
    });

    it("should handle null description", async () => {
      const mockOctokitInstance = new Octokit();
      const mockGet = mockOctokitInstance.repos.get as unknown as ReturnType<typeof vi.fn>;

      mockGet.mockResolvedValue({
        data: {
          name: "test-repo",
          description: null,
          clone_url: "https://github.com/org/test-repo.git",
          default_branch: "dev",
        },
      });

      const info = await getRepoInfo("token", "org", "repo");
      expect(info.description).toBeNull();
    });
  });
});
