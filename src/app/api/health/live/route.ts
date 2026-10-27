import { jsonData } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return jsonData({ status: "ok" });
}
