export type PasswordRuleStatus = {
  key: "minLength" | "uppercase" | "lowercase" | "number" | "special";
  label: string;
  valid: boolean;
};

export function getPasswordRuleStatuses(password: string): PasswordRuleStatus[] {
  return [
    {
      key: "minLength",
      label: "At least 6 characters",
      valid: password.length >= 6,
    },
    {
      key: "uppercase",
      label: "At least 1 uppercase letter",
      valid: /[A-Z]/.test(password),
    },
    {
      key: "lowercase",
      label: "At least 1 lowercase letter",
      valid: /[a-z]/.test(password),
    },
    {
      key: "number",
      label: "At least 1 number",
      valid: /\d/.test(password),
    },
    {
      key: "special",
      label: "At least 1 special character",
      valid: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function isStrongPassword(password: string) {
  return getPasswordRuleStatuses(password).every((rule) => rule.valid);
}
