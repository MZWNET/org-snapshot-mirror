import { Buffer } from "node:buffer";
import * as exec from "@actions/exec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { execGit } from "./core.js";

vi.mock("@actions/exec");

describe("git/core", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("execGit", () => {
    it("should execute git command with correct arguments", async () => {
      vi.mocked(exec.exec).mockResolvedValue(0);

      const result = await execGit(["status"], "/tmp/repo");

      expect(exec.exec).toHaveBeenCalledWith(
        "git",
        ["status"],
        expect.objectContaining({
          cwd: "/tmp/repo",
          silent: true,
          ignoreReturnCode: true,
        }),
      );
      expect(result.exitCode).toBe(0);
    });

    it("should capture stdout and stderr correctly", async () => {
      vi.mocked(exec.exec).mockImplementation(
        async (command, args, options) => {
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from("output data\n"));
          }
          if (options?.listeners?.stderr) {
            options.listeners.stderr(Buffer.from("error data\n"));
          }
          return 1;
        },
      );

      const result = await execGit(["status"], "/tmp/repo");

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("output data\n");
      expect(result.stderr).toBe("error data\n");
    });

    it("should pass custom environment variables", async () => {
      vi.mocked(exec.exec).mockResolvedValue(0);

      await execGit(["status"], "/tmp/repo", { CUSTOM_ENV: "value" });

      expect(exec.exec).toHaveBeenCalledWith(
        "git",
        ["status"],
        expect.objectContaining({
          env: expect.objectContaining({ CUSTOM_ENV: "value" }) as Record<string, string>,
        }),
      );
    });
  });
});
