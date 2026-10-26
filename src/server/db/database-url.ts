const SAFE_RECREATE_NAME = /^[a-z0-9]+(_[a-z0-9]+)*_test$/;
const DATABASE_NAME = /^[a-z0-9_]+$/;

export function connectionDatabaseName(connectionString: string): string {
  const name = decodeURIComponent(new URL(connectionString).pathname.slice(1));
  if (!DATABASE_NAME.test(name)) {
    throw new Error(`Unsupported database name: ${name}`);
  }
  return name;
}

export function withDatabase(connectionString: string, database: string): string {
  if (!DATABASE_NAME.test(database)) {
    throw new Error(`Unsupported database name: ${database}`);
  }
  const url = new URL(connectionString);
  url.pathname = `/${database}`;
  return url.toString();
}

export function integrationDatabaseUrl(configured: string): string {
  const current = connectionDatabaseName(configured);
  if (current.endsWith("_test")) {
    return configured;
  }
  return withDatabase(configured, `${current}_test`);
}

export function assertSafeDatabaseName(name: string): void {
  if (!SAFE_RECREATE_NAME.test(name)) {
    throw new Error(`Refusing to recreate database "${name}"`);
  }
}

export function migrateTestDatabaseName(testDatabaseName: string): string {
  assertSafeDatabaseName(testDatabaseName);
  return `${testDatabaseName.slice(0, -"_test".length)}_migrate_test`;
}
