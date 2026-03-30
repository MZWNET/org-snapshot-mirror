import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getInputs } from "./config.js";

vi.mock("@actions/core");

describe("config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getInputs", () => {
    it("should parse valid inputs", () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        switch (name) {
          case "source_org":
            return "org";
          case "source_token":
            return "token";
          case "source_repos":
            return "repo1, repo2";
          case "target_url":
            return "https://target.com";
          case "target_username":
            return "user";
          case "target_password":
            return "pass";
          case "target_platform":
            return "cnb";
          case "cnb_api_token":
            return "cnb_token";
          case "cnb_org_path":
            return "cnb_org";
          case "max_parallel":
            return "5";
          default:
            return "";
        }
      });

      const inputs = getInputs();

      expect(inputs).toEqual({
        sourceOrg: "org",
        sourceToken: "token",
        sourceRepos: [
          { name: "repo1", branches: undefined },
          { name: "repo2", branches: undefined },
        ],
        targetUrl: "https://target.com",
        targetUsername: "user",
        targetPassword: "pass",
        targetPlatform: "cnb",
        cnbApiToken: "cnb_token",
        cnbOrgPath: "cnb_org",
        maxParallel: 5,
      });
    });

    it("should parse valid inputs with branches", () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        switch (name) {
          case "source_org":
            return "org";
          case "source_token":
            return "token";
          case "source_repos":
            return "repo1:main, repo1:dev, repo2:master, repo3";
          case "target_url":
            return "https://target.com";
          case "target_username":
            return "user";
          case "target_password":
            return "pass";
          default:
            return "";
        }
      });

      const inputs = getInputs();

      expect(inputs.sourceRepos).toEqual([
        { name: "repo1", branches: ["main", "dev"] },
        { name: "repo2", branches: ["master"] },
        { name: "repo3", branches: undefined },
      ]);
    });

    it("should parse valid inputs with defaults", () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        switch (name) {
          case "source_org":
            return "org";
          case "source_token":
            return "token";
          case "source_repos":
            return "repo1";
          case "target_url":
            return "https://target.com";
          case "target_username":
            return "user";
          case "target_password":
            return "pass";
          default:
            return "";
        }
      });

      const inputs = getInputs();

      expect(inputs.targetPlatform).toBe("other");
      expect(inputs.cnbApiToken).toBeUndefined();
      expect(inputs.cnbOrgPath).toBeUndefined();
      expect(inputs.maxParallel).toBe(4); // default is 4
    });

    it("should throw error if source_repos is empty or only whitespace", () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === "source_repos")
          return "   ,  ";
        return "";
      });

      expect(() => getInputs()).toThrow(TypeError);
      expect(() => getInputs()).toThrow("source_repos must contain at least one repository");
    });

    it("should throw error if target_platform is invalid", () => {
      vi.mocked(core.getInput).mockImplementation((name) => {
        if (name === "source_repos")
          return "repo1";
        if (name === "target_platform")
          return "invalid_platform";
        return "";
      });

      expect(() => getInputs()).toThrow(Error);
      expect(() => getInputs()).toThrow("target_platform must be 'cnb' or 'other'");
    });
  });
});
