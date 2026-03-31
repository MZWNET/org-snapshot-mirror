import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLfs, pushLfs } from "./git/lfs.js";
import { createSnapshotCommits } from "./git/snapshot.js";
import { cloneMirror, pushToTarget } from "./git/sync.js";
import { createCnbRepo } from "./services/cnb.js";
import { getRepoInfo } from "./services/github.js";
import { syncRepo } from "./sync.js";
import { cleanupDir, createTempDir, errorWithPrefix, logWithPrefix } from "./utils.js";

vi.mock("./git/lfs.js");
vi.mock("./git/snapshot.js");
vi.mock("./git/sync.js");
vi.mock("./services/cnb.js");
vi.mock("./services/github.js");
vi.mock("./utils.js");

const defaultInputs = {
  sourceOrg: "org",
  sourceToken: "token",
  sourceRepos: [{ name: "repo1", branches: undefined }],
  targetUrl: "https://target.com",
  targetUsername: "user",
  targetPassword: "pass",
  targetPlatform: "other" as const,
  maxParallel: 1,
};

describe("sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getRepoInfo).mockResolvedValue({
      name: "repo1",
      description: "desc",
      cloneUrl: "https://clone",
      defaultBranch: "main",
    });

    vi.mocked(createTempDir).mockResolvedValue("/tmp/sync-repo1");
  });

  it("should successfully sync a repo without CNB", async () => {
    const result = await syncRepo({ name: "repo1" }, defaultInputs);

    expect(result).toEqual({ success: true });

    expect(getRepoInfo).toHaveBeenCalledWith("token", "org", "repo1");
    expect(createCnbRepo).not.toHaveBeenCalled();
    expect(createTempDir).toHaveBeenCalledWith("sync-repo1");

    expect(cloneMirror).toHaveBeenCalledWith(
      "https://token@github.com/org/repo1.git",
      "/tmp/sync-repo1/repo.git",
      "repo1",
    );
    expect(fetchLfs).toHaveBeenCalledWith(
      "/tmp/sync-repo1/repo.git",
      "https://token@github.com/org/repo1.git",
      "repo1",
    );
    expect(createSnapshotCommits).toHaveBeenCalledWith("/tmp/sync-repo1/repo.git", ["main"], "repo1");
    expect(pushToTarget).toHaveBeenCalledWith(
      "/tmp/sync-repo1/repo.git",
      "https://target.com/repo1.git",
      "user",
      "pass",
      ["main"],
      "repo1",
    );
    expect(pushLfs).toHaveBeenCalledWith("/tmp/sync-repo1/repo.git", "repo1");

    expect(cleanupDir).toHaveBeenCalledWith("/tmp/sync-repo1");
    expect(logWithPrefix).toHaveBeenCalledWith("repo1", "Sync completed successfully");
  });

  it("should successfully sync a repo with CNB", async () => {
    vi.mocked(createCnbRepo).mockResolvedValue({ success: true, alreadyExists: false });

    const inputs = {
      ...defaultInputs,
      targetPlatform: "cnb" as const,
      cnbApiToken: "cnb_token",
      cnbOrgPath: "cnb_org",
    };

    const result = await syncRepo({ name: "repo1" }, inputs);

    expect(result).toEqual({ success: true });
    expect(createCnbRepo).toHaveBeenCalledWith("cnb_token", "cnb_org", "repo1", "desc");
  });

  it("should use explicitly configured branches and preserve a target URL that already ends with slash", async () => {
    const result = await syncRepo({ name: "repo1", branches: ["release", "hotfix"] }, {
      ...defaultInputs,
      targetUrl: "https://target.com/",
    });

    expect(result).toEqual({ success: true });
    expect(createSnapshotCommits).toHaveBeenCalledWith("/tmp/sync-repo1/repo.git", ["release", "hotfix"], "repo1");
    expect(pushToTarget).toHaveBeenCalledWith(
      "/tmp/sync-repo1/repo.git",
      "https://target.com/repo1.git",
      "user",
      "pass",
      ["release", "hotfix"],
      "repo1",
    );
  });

  it("should log when the CNB repo already exists", async () => {
    vi.mocked(createCnbRepo).mockResolvedValue({ success: true, alreadyExists: true });

    const result = await syncRepo({ name: "repo1" }, {
      ...defaultInputs,
      targetPlatform: "cnb",
      cnbApiToken: "cnb_token",
      cnbOrgPath: "cnb_org",
    });

    expect(result).toEqual({ success: true });
    expect(logWithPrefix).toHaveBeenCalledWith("repo1", "Repo already exists on CNB");
  });

  it("should fail when CNB repo creation fails", async () => {
    vi.mocked(createCnbRepo).mockResolvedValue({ success: false, alreadyExists: false, error: "permission denied" });

    const result = await syncRepo({ name: "repo1" }, {
      ...defaultInputs,
      targetPlatform: "cnb",
      cnbApiToken: "cnb_token",
      cnbOrgPath: "cnb_org",
    });

    expect(result).toEqual({
      success: false,
      error: "Failed to create CNB repo: permission denied",
    });
    expect(createTempDir).not.toHaveBeenCalled();
    expect(cleanupDir).not.toHaveBeenCalled();
    expect(errorWithPrefix).toHaveBeenCalledWith("repo1", "Sync failed: Failed to create CNB repo: permission denied");
  });

  it("should fail if CNB inputs are missing", async () => {
    const inputs = {
      ...defaultInputs,
      targetPlatform: "cnb" as const,
    };

    const result = await syncRepo({ name: "repo1" }, inputs);

    expect(result.success).toBe(false);
    expect(result.error).toMatch("cnb_api_token and cnb_org_path are required");
    expect(errorWithPrefix).toHaveBeenCalled();
  });

  it("should safely cleanup if an intermediate step fails", async () => {
    vi.mocked(cloneMirror).mockRejectedValue(new Error("Clone failed"));

    const result = await syncRepo({ name: "repo1" }, defaultInputs);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Clone failed");

    expect(cleanupDir).toHaveBeenCalledWith("/tmp/sync-repo1");
  });
});
