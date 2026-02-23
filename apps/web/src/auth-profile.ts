export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);
  if (!normalized) {
    return { valid: false as const, error: "Username is required." };
  }

  if (!/^[a-z0-9._]{3,24}$/.test(normalized)) {
    return {
      valid: false as const,
      error: "Username must be 3-24 chars using letters, numbers, dot, or underscore.",
    };
  }

  return { valid: true as const, error: "" };
}
