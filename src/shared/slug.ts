import { randomBytes } from "node:crypto";

export function createSlug(title: string): string {
  const ascii = title
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = randomBytes(3).toString("hex");
  return ascii ? `${ascii}-${suffix}` : `p-${suffix}`;
}
