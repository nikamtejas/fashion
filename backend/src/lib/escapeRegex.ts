/** Escapes regex metacharacters in free-text user input before it's used
 * inside a MongoDB $regex filter — unescaped, a search string containing an
 * unbalanced `(`, `[`, or trailing `\` throws "Regular expression is
 * invalid" and 500s the request instead of just matching nothing. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
