/**
 * Avatar colour tokens.
 *
 * A user carries a token rather than a hex value, so the palette lives in the
 * stylesheet alongside every other colour and an avatar can never drift from
 * the theme (Requirement 13.5).
 */

export type AvatarColorToken =
  | "avatar-indigo"
  | "avatar-teal"
  | "avatar-amber"
  | "avatar-rose"
  | "avatar-violet";

export const AVATAR_COLOR_TOKENS: readonly AvatarColorToken[] = [
  "avatar-indigo",
  "avatar-teal",
  "avatar-amber",
  "avatar-rose",
  "avatar-violet",
];

/**
 * Initials for an avatar: first letters of the first two words, uppercased.
 * "Alice Nguyen" becomes "AN", "Bob" becomes "B".
 */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
