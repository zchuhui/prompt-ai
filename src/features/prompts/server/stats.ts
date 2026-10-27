import "server-only";

import { sql } from "drizzle-orm";
import type { Database } from "@/server/db/client";

export async function getAdminOverview(db: Database) {
  const [counts] = (
    await db.execute<{
      drafts: number;
      published: number;
      pending_uploads: number;
      failed_uploads: number;
      collections: number;
    }>(sql`
      select
        (select count(*)::int from prompts where deleted_at is null and status = 'draft') as drafts,
        (select count(*)::int from prompts where deleted_at is null and status = 'published') as published,
        (select count(*)::int from upload_items where status in ('pending', 'uploading', 'processing')) as pending_uploads,
        (select count(*)::int from upload_items where status = 'failed') as failed_uploads,
        (select count(*)::int from collections) as collections
    `)
  ).rows;

  const recent = (
    await db.execute<{
      id: string;
      title: string;
      status: "draft" | "published";
      updated_at: Date | string;
      cover_id: string | null;
    }>(sql`
      select p.id, p.title, p.status, p.updated_at, a.id as cover_id
      from prompts p
      left join assets a on a.id = p.cover_asset_id and a.status = 'ready'
      where p.deleted_at is null
      order by p.updated_at desc, p.id desc
      limit 6
    `)
  ).rows;

  return {
    drafts: Number(counts?.drafts ?? 0),
    published: Number(counts?.published ?? 0),
    pendingUploads: Number(counts?.pending_uploads ?? 0),
    failedUploads: Number(counts?.failed_uploads ?? 0),
    collections: Number(counts?.collections ?? 0),
    recent: recent.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      updatedAt: new Date(row.updated_at).toISOString(),
      coverId: row.cover_id,
    })),
  };
}
