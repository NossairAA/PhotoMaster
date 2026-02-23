function extractAuthCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }

  if (error instanceof Error) {
    const match = error.message.match(/auth\/[a-z-]+/i);
    if (match) return match[0].toLowerCase();
    if (/^auth\//i.test(error.message)) return error.message.toLowerCase();
  }

  return "";
}

export function mapAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const plainMessage = error.message.trim();
    if (/username is already taken/i.test(plainMessage)) {
      return "This username is already taken. Try another one.";
    }
    if (/firebase client configuration is missing/i.test(plainMessage)) {
      return "Authentication is not configured correctly yet. Please contact support.";
    }
  }

  const code = extractAuthCode(error);

  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Try signing in instead.";
    case "auth/account-exists-with-different-credential":
      return "This email is already linked to another sign-in method. Use your existing sign-in option.";
    case "auth/account-already-exists":
      return "An account already exists with this email. Please sign in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Email/username or password is incorrect.";
    case "auth/user-not-found":
    case "auth/username-not-found":
      return "We could not find an account with that login.";
    case "auth/username-email-missing":
      return "Please sign in with your email first, then you can use your username next time.";
    case "auth/username-reserved":
      return "This username is unavailable. Please choose another one.";
    case "auth/missing-identifier":
      return "Enter your email or username to continue.";
    case "auth/google-email-missing":
      return "Google did not provide an email for this account. Please use email sign-up.";
    case "auth/google-email-mismatch":
      return "Use the same email in the form and in Google sign-up, or sign in with your existing account.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Please allow popups and try again.";
    case "auth/network-request-failed":
      return "Network issue detected. Please check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "permission-denied":
      return "We could not complete this request right now. Please try again.";
    default:
      if (error instanceof Error && error.message.trim()) {
        if (error.message.includes("insufficient permissions")) {
          return "We could not complete this request right now. Please try again.";
        }
      }
      return fallback;
  }
}
