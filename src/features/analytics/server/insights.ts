import "server-only";

import { sql } from "drizzle-orm";
import type { Database } from "@/server/db/client";

export type InsightsRange = 7 | 30;

export async function getInsights(db: Database, days: InsightsRange, now = new Date()) {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [totals] = (
    await db.execute<{
      page_view: number;
      detail_view: number;
      prompt_copy: number;
      search: number;
      search_empty: number;
    }>(sql`
      select
        count(*) filter (where kind = 'page_view')::int as page_view,
        count(*) filter (where kind = 'detail_view')::int as detail_view,
        count(*) filter (where kind = 'prompt_copy')::int as prompt_copy,
        count(*) filter (where kind = 'search')::int as search,
        count(*) filter (where kind = 'search_empty')::int as search_empty
      from analytics_events
      where created_at >= ${since}
    `)
  ).rows;

  const daily = (
    await db.execute<{ day: string; detail_view: number; prompt_copy: number }>(sql`
      select
        to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') as day,
        count(*) filter (where kind = 'detail_view')::int as detail_view,
        count(*) filter (where kind = 'prompt_copy')::int as prompt_copy
      from analytics_events
      where created_at >= ${since}
      group by 1
      order by 1
    `)
  ).rows;

  const topPrompts = (
    await db.execute<{
      id: string;
      slug: string;
      title: string;
      detail_view: number;
      prompt_copy: number;
    }>(sql`
      select
        p.id,
        p.slug,
        p.title,
        count(*) filter (where e.kind = 'detail_view')::int as detail_view,
        count(*) filter (where e.kind = 'prompt_copy')::int as prompt_copy
      from analytics_events e
      join prompts p on p.id = e.prompt_id
      where e.created_at >= ${since}
        and p.status = 'published'
        and p.deleted_at is null
      group by p.id, p.slug, p.title
      order by prompt_copy desc, detail_view desc, p.id
      limit 10
    `)
  ).rows;

  const emptySearches = (
    await db.execute<{ query: string; count: number }>(sql`
      select lower(btrim(query_text)) as query, count(*)::int as count
      from analytics_events
      where kind = 'search_empty'
        and created_at >= ${since}
        and query_text is not null
        and btrim(query_text) <> ''
      group by 1
      order by count desc, query
      limit 15
    `)
  ).rows;

  const detailViews = Number(totals?.detail_view ?? 0);
  const copies = Number(totals?.prompt_copy ?? 0);
  return {
    days,
    since: since.toISOString(),
    totals: {
      pageViews: Number(totals?.page_view ?? 0),
      detailViews,
      copies,
      searches: Number(totals?.search ?? 0) + Number(totals?.search_empty ?? 0),
      emptySearches: Number(totals?.search_empty ?? 0),
      copyRate: detailViews > 0 ? copies / detailViews : null,
    },
    daily: daily.map((row) => ({
      day: row.day,
      detailViews: Number(row.detail_view),
      copies: Number(row.prompt_copy),
    })),
    topPrompts: topPrompts.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      detailViews: Number(row.detail_view),
      copies: Number(row.prompt_copy),
    })),
    emptySearches: emptySearches.map((row) => ({ query: row.query, count: Number(row.count) })),
  };
}
