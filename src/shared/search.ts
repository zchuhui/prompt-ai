export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function likePattern(value: string): string {
  return `%${escapeLike(value)}%`;
}
