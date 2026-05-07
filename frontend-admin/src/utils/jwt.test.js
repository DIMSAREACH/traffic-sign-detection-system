import { describe, expect, it } from "vitest";
import { getJwtExpiryMs } from "../utils/jwt.js";

describe("getJwtExpiryMs", () => {
  it("reads exp from a JWT-shaped string", () => {
    const payload = { exp: 1_000_000 };
    const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `e30.${b64}.sig`;
    expect(getJwtExpiryMs(token)).toBe(1_000_000_000);
  });
});
