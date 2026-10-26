import { describe, expect, it } from "vitest";
import {
  assertSafeDatabaseName,
  connectionDatabaseName,
  integrationDatabaseUrl,
  migrateTestDatabaseName,
  withDatabase,
} from "./database-url";

const devUrl = "postgresql://prompt:local-only@127.0.0.1:5432/prompt_gallery";

describe("database urls", () => {
  it("derives a sibling test database and leaves an existing test database unchanged", () => {
    expect(integrationDatabaseUrl(devUrl)).toBe(
      "postgresql://prompt:local-only@127.0.0.1:5432/prompt_gallery_test",
    );
    expect(integrationDatabaseUrl(`${devUrl}_test`)).toBe(`${devUrl}_test`);
  });

  it("replaces only the database name", () => {
    expect(connectionDatabaseName(devUrl)).toBe("prompt_gallery");
    expect(withDatabase(devUrl, "postgres")).toBe(
      "postgresql://prompt:local-only@127.0.0.1:5432/postgres",
    );
  });

  it("refuses to recreate the development database", () => {
    expect(() => assertSafeDatabaseName("prompt_gallery")).toThrow(/Refusing/);
    expect(() => assertSafeDatabaseName("prompt_gallery_test")).not.toThrow();
    expect(migrateTestDatabaseName("prompt_gallery_test")).toBe(
      "prompt_gallery_migrate_test",
    );
  });
});
