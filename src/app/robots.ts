import type { MetadataRoute } from "next";
import { getEnv } from "@/server/env";

export default function robots(): MetadataRoute.Robots {
  const origin = new URL(getEnv().APP_URL).origin;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
