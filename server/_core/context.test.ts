import { afterEach, describe, expect, it, vi } from "vitest";

describe("authenticateRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("authenticates fnOS gateway admin headers in native mode", async () => {
    vi.resetModules();
    vi.stubEnv("FNOS_NATIVE", "1");
    const { authenticateRequest } = await import("./context");

    const user = await authenticateRequest({
      headers: {
        "x-trim-userid": "1000",
        "x-trim-isadmin": "true",
        "x-trim-username": "admin",
      },
    } as any);

    expect(user).toMatchObject({
      openId: "fnos:1000",
      name: "admin",
      role: "admin",
      loginMethod: "fnos-gateway",
    });
  });

  it("rejects non-admin fnOS gateway users", async () => {
    vi.resetModules();
    vi.stubEnv("FNOS_NATIVE", "1");
    const { authenticateRequest } = await import("./context");

    const user = await authenticateRequest({
      headers: {
        "x-trim-userid": "1001",
        "x-trim-isadmin": "false",
        "x-trim-username": "user",
      },
    } as any);

    expect(user).toBeNull();
  });
});
