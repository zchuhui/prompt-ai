import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

export function maxChars(column: SQLWrapper, max: number): SQL {
  if (!Number.isInteger(max) || max < 1) {
    throw new Error(`Invalid text length: ${max}`);
  }
  return sql`char_length(${column}) <= ${sql.raw(String(max))}`;
}

export function canonicalName(column: SQLWrapper): SQL {
  return sql`${column} = lower(btrim(${column}))`;
}
