import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCnbRepo } from "./cnb.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("services/cnb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCnbRepo", () => {
    it("should return success when repo is created", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
      });

      const result = await createCnbRepo("token", "path/org", "repo", "Description");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.cnb.cool/path/org/-/repos",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Authorization": "Bearer token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "repo",
            description: "Description",
            visibility: "public",
          }),
        }),
      );
      expect(result).toEqual({ success: true, alreadyExists: false });
    });

    it("should use default description if none is provided", async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await createCnbRepo("token", "path", "repo", null);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            name: "repo",
            description: "Mirror of GitHub repo repo",
            visibility: "public",
          }),
        }),
      );
    });

    it("should handle 409 already exists", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 409,
      });

      const result = await createCnbRepo("token", "path", "repo", null);

      expect(result).toEqual({ success: true, alreadyExists: true });
    });

    it("should handle non-ok server response with message", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await createCnbRepo("token", "path", "repo", null);

      expect(result).toEqual({ success: false, alreadyExists: false, error: "HTTP 500: Internal Server Error" });
    });

    it("should handle network errors", async () => {
      const fetchError = new Error("Network failure");
      fetchMock.mockRejectedValue(fetchError);

      const result = await createCnbRepo("token", "path", "repo", null);

      expect(result).toEqual({ success: false, alreadyExists: false, error: String(fetchError) });
    });
  });
});
