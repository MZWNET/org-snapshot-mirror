import { beforeEach, describe, expect, it, vi } from "vitest";
import { logWithPrefix } from "../utils.js";
import { execGit } from "./core.js";
import { createSnapshotCommits } from "./snapshot.js";

vi.mock("../utils.js", () => ({
  logWithPrefix: vi.fn(),
}));

vi.mock("./core.js", () => ({
  execGit: vi.fn(),
}));

describe("git/snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSnapshotCommits", () => {
    it("should successfully create snapshot commits and update refs", async () => {
      // Mock branches
      vi.mocked(execGit).mockImplementation(async (args) => {
        if (args[0] === "for-each-ref") {
          return {
            exitCode: 0,
            stdout: "refs/heads/main\nrefs/heads/dev",
            stderr: "",
          };
        }
        else if (args[0] === "log" && args[2].startsWith("--format=%an")) {
          return {
            exitCode: 0,
            stdout: "Author Name\nauthor@example.com\n2023-01-01T00:00:00Z\nCommitter Name\ncommitter@example.com\n2023-01-01T00:00:00Z\ntree hash",
            stderr: "",
          };
        }
        else if (args[0] === "log" && args[2] === "--format=%B") {
          return {
            exitCode: 0,
            stdout: "Commit message",
            stderr: "",
          };
        }
        else if (args[0] === "commit-tree") {
          return {
            exitCode: 0,
            stdout: "new-commit-hash",
            stderr: "",
          };
        }
        else if (args[0] === "update-ref") {
          return {
            exitCode: 0,
            stdout: "",
            stderr: "",
          };
        }
        return { exitCode: 1, stdout: "", stderr: "Unknown command mocked" };
      });

      await createSnapshotCommits("/tmp/repo", "PREFIX");

      expect(execGit).toHaveBeenCalledWith(
        ["for-each-ref", "--format=%(refname)", "refs/heads/"],
        "/tmp/repo",
      );

      // Should process both branches: main and dev
      expect(execGit).toHaveBeenCalledWith(
        ["log", "-1", "--format=%an%n%ae%n%aI%n%cn%n%ce%n%cI%n%T", "refs/heads/main"],
        "/tmp/repo",
      );
      expect(execGit).toHaveBeenCalledWith(
        ["log", "-1", "--format=%B", "refs/heads/main"],
        "/tmp/repo",
      );

      expect(execGit).toHaveBeenCalledWith(
        ["commit-tree", "tree hash", "-m", "Commit message"],
        "/tmp/repo",
        expect.objectContaining({
          GIT_AUTHOR_NAME: "Author Name",
          GIT_AUTHOR_EMAIL: "author@example.com",
          GIT_AUTHOR_DATE: "2023-01-01T00:00:00Z",
          GIT_COMMITTER_NAME: "Committer Name",
          GIT_COMMITTER_EMAIL: "committer@example.com",
          GIT_COMMITTER_DATE: "2023-01-01T00:00:00Z",
        }),
      );

      expect(execGit).toHaveBeenCalledWith(
        ["update-ref", "refs/heads/main", "new-commit-hash"],
        "/tmp/repo",
      );

      expect(logWithPrefix).toHaveBeenCalledWith("PREFIX", "Creating snapshot commits...");
      expect(logWithPrefix).toHaveBeenCalledWith("PREFIX", "Found 2 branches");
    });

    it("should throw an error if listBranches fails", async () => {
      vi.mocked(execGit).mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "fatal error",
      });

      await expect(createSnapshotCommits("/tmp/repo", "PREFIX"))
        .rejects
        .toThrow("Failed to list branches: fatal error");
    });

    it("should throw an error if creating orphan commit fails", async () => {
      vi.mocked(execGit).mockImplementation(async (args) => {
        if (args[0] === "for-each-ref") {
          return {
            exitCode: 0,
            stdout: "refs/heads/main",
            stderr: "",
          };
        }
        else if (args[0] === "commit-tree") {
          return {
            exitCode: 1,
            stdout: "",
            stderr: "commit-tree failed",
          };
        }
        return { exitCode: 0, stdout: "test", stderr: "" };
      });

      await expect(createSnapshotCommits("/tmp/repo", "PREFIX"))
        .rejects
        .toThrow("Failed to create orphan commit: commit-tree failed");
    });
  });
});
