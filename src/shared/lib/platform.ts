/** Platform detection for keyboard shortcut handling and labels. */

const MAC_PLATFORM_PATTERN = /mac|iphone|ipad/i;

/** True when running on macOS (Cmd is the primary modifier). */
export function isMacPlatform(): boolean {
  return MAC_PLATFORM_PATTERN.test(navigator.userAgent);
}
