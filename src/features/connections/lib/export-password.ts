/** Validation of the password that encrypts exported secrets. */

/** Minimum length of the password protecting exported secrets. */
export const MIN_EXPORT_PASSWORD_LENGTH = 8;

/** Explains why the export password is not acceptable yet, or `null` when it is. */
export function exportPasswordProblem(password: string, confirmation: string): string | null {
  if (password.length < MIN_EXPORT_PASSWORD_LENGTH) {
    return `Use at least ${MIN_EXPORT_PASSWORD_LENGTH} characters.`;
  }
  return password === confirmation ? null : "The passwords do not match.";
}
