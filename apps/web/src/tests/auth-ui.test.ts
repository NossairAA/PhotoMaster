import { describe, expect, it } from "vitest";
import { getHeaderAuthActionLabel, shouldShowTreatmentWorkspace, shouldShowWelcomeHero } from "../auth-ui";

describe("getHeaderAuthActionLabel", () => {
  it("returns sign-in label when user is not authenticated", () => {
    expect(getHeaderAuthActionLabel(false, { signIn: "Sign in", account: "Account" })).toBe("Sign in");
  });

  it("returns account label when user is authenticated", () => {
    expect(getHeaderAuthActionLabel(true, { signIn: "Sign in", account: "Account" })).toBe("Account");
  });
});

describe("shouldShowWelcomeHero", () => {
  it("shows the hero when user is signed out", () => {
    expect(shouldShowWelcomeHero(false)).toBe(true);
  });

  it("hides the hero when user is signed in", () => {
    expect(shouldShowWelcomeHero(true)).toBe(false);
  });
});

describe("shouldShowTreatmentWorkspace", () => {
  it("shows treatment workspace when user is signed in", () => {
    expect(shouldShowTreatmentWorkspace(true)).toBe(true);
  });

  it("hides treatment workspace when user is signed out", () => {
    expect(shouldShowTreatmentWorkspace(false)).toBe(false);
  });
});
