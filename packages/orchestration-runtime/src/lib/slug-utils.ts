/**
 * Generate a URL-safe slug from a string.
 * Converts to lowercase, removes special characters (except Korean), and removes trailing hyphens.
 *
 * @param text - The text to convert to a slug
 * @param maxLength - Optional maximum length for the slug (default: no limit)
 * @returns The generated slug
 */
export function generateSlug(text: string, maxLength?: number): string {
  let slug = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/-+$/, "");

  if (maxLength !== undefined && slug.length > maxLength) {
    slug = slug.slice(0, maxLength).replace(/-+$/, "");
  }

  return slug;
}
