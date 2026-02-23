import { describe, expect, it } from "vitest";
import { mapAuthErrorMessage } from "../auth-errors";

describe("mapAuthErrorMessage", () => {
  it("maps firebase error codes to user-friendly messages", () => {
    const message = mapAuthErrorMessage({ code: "auth/email-already-in-use" }, "Fallback");
    expect(message).toBe("This email is already registered. Try signing in instead.");
  });

  it("maps username-not-found to user-friendly message", () => {
    const message = mapAuthErrorMessage(new Error("auth/username-not-found"), "Fallback");
    expect(message).toBe("We could not find an account with that login.");
  });

  it("maps username reserved to user-friendly message", () => {
    const message = mapAuthErrorMessage(new Error("auth/username-reserved"), "Fallback");
    expect(message).toBe("This username is unavailable. Please choose another one.");
  });

  it("maps account already exists from google signup", () => {
    const message = mapAuthErrorMessage(new Error("auth/account-already-exists"), "Fallback");
    expect(message).toBe("An account already exists with this email. Please sign in instead.");
  });

  it("maps google email mismatch to user-friendly message", () => {
    const message = mapAuthErrorMessage(new Error("auth/google-email-mismatch"), "Fallback");
    expect(message).toBe("Use the same email in the form and in Google sign-up, or sign in with your existing account.");
  });

  it("uses fallback for unknown errors", () => {
    const message = mapAuthErrorMessage(new Error("unexpected"), "Please try again.");
    expect(message).toBe("Please try again.");
  });
});
