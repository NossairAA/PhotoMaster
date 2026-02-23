import { describe, expect, it } from "vitest";
import { normalizeUsername, validateUsername } from "../auth-profile";

describe("auth profile helpers", () => {
  it("normalizes username", () => {
    expect(normalizeUsername("  John.Doe_7 ")).toBe("john.doe_7");
  });

  it("rejects invalid usernames", () => {
    expect(validateUsername("ab").valid).toBe(false);
    expect(validateUsername("bad-name").valid).toBe(false);
  });

  it("accepts valid usernames", () => {
    const result = validateUsername("john_doe.77");
    expect(result.valid).toBe(true);
  });
});
