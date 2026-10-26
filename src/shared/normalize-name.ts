export function normalizeName(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}
