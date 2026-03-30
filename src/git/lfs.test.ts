import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logWithPrefix } from "../utils.js";
import { execGit } from "./core.js";
import { fetchLfs, installLfs, pushLfs } from "./lfs.js";

vi.mock("@actions/core");
vi.mock("../utils.js", () => ({
  logWithPrefix: vi.fn(),
}));
vi.mock("./core.js", () => ({
  execGit: vi.fn(),
}));

describe("git/lfs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchLfs", () => {
    it("should fetch LFS successfully", async () => {
      vi.mocked(execGit).mockResolvedValue({ exitCode: 0, stdout: "", stderr: "fetch success" });

      await fetchLfs("/tmp/repo", "https://source.com/repo.git", "PREFIX");

      expect(execGit).toHaveBeenCalledWith(
        ["lfs", "fetch", "--all", "https://source.com/repo.git"],
        "/tmp/repo",
      );
      expect(logWithPrefix).toHaveBeenCalledWith("PREFIX", "Fetching LFS objects...");
      expect(logWithPrefix).toHaveBeenCalledWith("PREFIX", "fetch success");
    });

    it("should log warning on fetch failure", async () => {
      vi.mocked(execGit).mockResolvedValue({ exitCode: 1, stdout: "", stderr: "fetch error" });

      await fetchLfs("/tmp/repo", "https://source.com", "PREFIX");

      expect(core.warning).toHaveBeenCalledWith("[PREFIX] LFS fetch warning: fetch error");
    });
  });

  describe("pushLfs", () => {
    it("should push LFS successfully", async () => {
      vi.mocked(execGit).mockResolvedValue({ exitCode: 0, stdout: "", stderr: "push success" });

      await pushLfs("/tmp/repo", "PREFIX");

      expect(execGit).toHaveBeenCalledWith(["lfs", "push", "--all", "target"], "/tmp/repo");
      expect(logWithPrefix).toHaveBeenCalledWith("PREFIX", "Pushing LFS objects...");
      expect(logWithPrefix).toHaveBeenCalledWith("PREFIX", "push success");
    });

    it("should log warning on push failure", async () => {
      vi.mocked(execGit).mockResolvedValue({ exitCode: 1, stdout: "", stderr: "push error" });

      await pushLfs("/tmp/repo", "PREFIX");

      expect(core.warning).toHaveBeenCalledWith("[PREFIX] LFS push warning: push error");
    });
  });

  describe("installLfs", () => {
    it("should install LFS and configure git cleanly", async () => {
      vi.mocked(execGit).mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      await installLfs();

      expect(execGit).toHaveBeenCalledWith(["lfs", "install"], ".");
      expect(execGit).toHaveBeenCalledWith(["config", "--global", "lfs.locksverify", "true"], ".");
    });

    it("should log warnings if LFS install/config fails", async () => {
      vi.mocked(execGit).mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "install error" });
      vi.mocked(execGit).mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "config error" });

      await installLfs();

      expect(core.warning).toHaveBeenCalledWith("LFS install warning: install error");
      expect(core.warning).toHaveBeenCalledWith("LFS config warning: config error");
    });
  });
});
