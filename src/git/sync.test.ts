import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuthUrl, logWithPrefix } from "../utils.js";
import { execGit } from "./core.js";
import { cloneMirror, pushToTarget } from "./sync.js";

vi.mock("../utils.js", () => ({
  logWithPrefix: vi.fn(),
  buildAuthUrl: vi.fn(),
}));

vi.mock("./core.js", () => ({
  execGit: vi.fn(),
}));

describe("git/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cloneMirror", () => {
    it("should execute clone with mirror flag", async () => {
      vi.mocked(execGit).mockResolvedValue({
        exitCode: 0,
        stdout: "",
        stderr: "Cloning into...",
      });

      await cloneMirror("https://source.com/repo.git", "/tmp/repo", "PREFIX");

      expect(execGit).toHaveBeenCalledWith(
        ["clone", "--mirror", "https://source.com/repo.git", "/tmp/repo"],
        ".",
      );
      expect(logWithPrefix).toHaveBeenCalledWith("PREFIX", "Cloning mirror...");
      expect(logWithPrefix).toHaveBeenCalledWith("PREFIX", "Cloning into...");
    });

    it("should throw error if clone fails", async () => {
      vi.mocked(execGit).mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "fatal error",
      });

      await expect(
        cloneMirror("https://source.com/repo.git", "/tmp/repo", "PREFIX"),
      ).rejects.toThrow("Failed to clone: fatal error");
    });
  });

  describe("pushToTarget", () => {
    it("should configure remote and push branches", async () => {
      vi.mocked(buildAuthUrl).mockReturnValue("https://user:pass@target.com/");
      vi.mocked(execGit).mockResolvedValue({
        exitCode: 0,
        stdout: "",
        stderr: "Pushed successfully...",
      });

      await pushToTarget(
        "/tmp/repo",
        "https://target.com",
        "user",
        "pass",
        "PREFIX",
      );

      expect(buildAuthUrl).toHaveBeenCalledWith("https://target.com", "user", "pass");

      // remote add
      expect(execGit).toHaveBeenCalledWith(
        ["remote", "add", "target", "https://user:pass@target.com/"],
        "/tmp/repo",
      );

      // config lfs locksverify
      expect(execGit).toHaveBeenCalledWith(
        ["config", "lfs.https://target.com/info/lfs.locksverify", "true"],
        "/tmp/repo",
      );

      // push target
      expect(execGit).toHaveBeenCalledWith(
        ["push", "target", "--force", "refs/heads/*:refs/heads/*", "refs/tags/*:refs/tags/*"],
        "/tmp/repo",
      );

      expect(logWithPrefix).toHaveBeenCalledWith("PREFIX", "Pushing to target...");
      expect(logWithPrefix).toHaveBeenCalledWith("PREFIX", "Pushed successfully...");
    });

    it("should throw error if push fails", async () => {
      vi.mocked(buildAuthUrl).mockReturnValue("url");
      vi.mocked(execGit).mockImplementation(async (args) => {
        if (args[0] === "push") {
          return { exitCode: 1, stdout: "", stderr: "push failed" };
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      });

      await expect(
        pushToTarget("/tmp/repo", "target", "user", "pass", "PREFIX"),
      ).rejects.toThrow("Failed to push: push failed");
    });
  });
});
