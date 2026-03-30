import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthUrl,
  cleanupDir,
  createTempDir,
  errorWithPrefix,
  logWithPrefix,
} from "./utils.js";

vi.mock("node:fs/promises");
vi.mock("node:os");
vi.mock("@actions/core");

describe("utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTempDir", () => {
    it("should create a temporary directory", async () => {
      vi.mocked(os.tmpdir).mockReturnValue("/tmp");
      vi.mocked(fs.mkdtemp).mockResolvedValue("/tmp/prefix-12345");

      const dir = await createTempDir("prefix");

      expect(os.tmpdir).toHaveBeenCalled();
      expect(fs.mkdtemp).toHaveBeenCalledWith(path.join("/tmp", "prefix-"));
      expect(dir).toBe("/tmp/prefix-12345");
    });
  });

  describe("cleanupDir", () => {
    it("should remove directory cleanly", async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      await cleanupDir("/tmp/dir");

      expect(fs.rm).toHaveBeenCalledWith("/tmp/dir", {
        recursive: true,
        force: true,
      });
      expect(core.warning).not.toHaveBeenCalled();
    });

    it("should log warning if removal fails", async () => {
      const error = new Error("Permission denied");
      vi.mocked(fs.rm).mockRejectedValue(error);

      await cleanupDir("/tmp/dir");

      expect(fs.rm).toHaveBeenCalledWith("/tmp/dir", {
        recursive: true,
        force: true,
      });
      expect(core.warning).toHaveBeenCalledWith(
        `Failed to cleanup directory /tmp/dir: Error: Permission denied`,
      );
    });
  });

  describe("logWithPrefix", () => {
    it("should log multiple lines with prefix", () => {
      logWithPrefix("PREFIX", "line 1\nline 2\n\nline 3");

      expect(core.info).toHaveBeenCalledTimes(3);
      expect(core.info).toHaveBeenNthCalledWith(1, "[PREFIX] line 1");
      expect(core.info).toHaveBeenNthCalledWith(2, "[PREFIX] line 2");
      expect(core.info).toHaveBeenNthCalledWith(3, "[PREFIX] line 3");
    });

    it("should ignore empty lines", () => {
      logWithPrefix("PREFIX", "   \nline 1\n");

      expect(core.info).toHaveBeenCalledTimes(1);
      expect(core.info).toHaveBeenCalledWith("[PREFIX] line 1");
    });
  });

  describe("errorWithPrefix", () => {
    it("should log error with prefix", () => {
      errorWithPrefix("PREFIX", "An error occurred");

      expect(core.error).toHaveBeenCalledTimes(1);
      expect(core.error).toHaveBeenCalledWith("[PREFIX] An error occurred");
    });
  });

  describe("buildAuthUrl", () => {
    it("should build URL with credentials", () => {
      const url = buildAuthUrl("https://github.com", "user", "pass");
      expect(url).toBe("https://user:pass@github.com/");
    });

    it("should properly encode credentials", () => {
      const url = buildAuthUrl("https://github.com", "user@email.com", "p@ssword!");
      // The browser/node URL will correctly encode them in the href
      // Note: URL parsing encodes it properly for the credentials part
      expect(url).toBe("https://user%40email.com:p%40ssword!@github.com/");
    });
  });
});
