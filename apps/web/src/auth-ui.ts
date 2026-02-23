export function getHeaderAuthActionLabel(isAuthenticated: boolean, labels: { signIn: string; account: string }) {
  return isAuthenticated ? labels.account : labels.signIn;
}

export function shouldShowWelcomeHero(isAuthenticated: boolean) {
  return !isAuthenticated;
}

export function shouldShowTreatmentWorkspace(isAuthenticated: boolean) {
  return isAuthenticated;
}
