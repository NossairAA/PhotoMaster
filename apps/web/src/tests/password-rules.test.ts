import { describe, expect, it } from "vitest";
import { getPasswordRuleStatuses, isStrongPassword } from "../password-rules";

describe("password rules", () => {
  it("marks weak password as invalid", () => {
    const rules = getPasswordRuleStatuses("abc");
    expect(rules.find((item) => item.key === "minLength")?.valid).toBe(false);
    expect(rules.find((item) => item.key === "uppercase")?.valid).toBe(false);
    expect(rules.find((item) => item.key === "number")?.valid).toBe(false);
    expect(isStrongPassword("abc")).toBe(false);
  });

  it("accepts strong password with length >= 6", () => {
    expect(isStrongPassword("A1b!zz")).toBe(true);
  });
});
