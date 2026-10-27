import { request, type APIRequestContext, type Page } from "@playwright/test";
import sharp from "sharp";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const adminUsername = process.env.E2E_ADMIN_USERNAME ?? "";
export const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
export const hasAdmin = Boolean(adminUsername && adminPassword);

export async function pngBuffer(hue: number, width = 480, height = 640): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},80%,55%)"/><stop offset="1" stop-color="hsl(${hue + 60},70%,18%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${width / 2}" cy="${height / 2}" r="${width / 4}" fill="rgba(255,255,255,0.18)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

type Taxonomy = { id: string; slug: string; active?: boolean };
type AdminPrompt = { id: string; slug: string; version: number; assetItems: Array<{ status: string }> };

/** Talks to the admin HTTP API the same way the browser does (cookie + CSRF + Origin). */
export class AdminApi {
  private constructor(
    private readonly context: APIRequestContext,
    private readonly csrf: string,
  ) {}

  static async login(): Promise<AdminApi> {
    const context = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { origin: BASE_URL },
    });
    const login = await context.post("/api/v1/auth/login", {
      data: { username: adminUsername, password: adminPassword },
    });
    if (!login.ok()) {
      throw new Error(`admin login failed: ${login.status()}`);
    }
    const session = await context.get("/api/v1/auth/session");
    const { data } = (await session.json()) as { data: { csrfToken: string } };
    return new AdminApi(context, data.csrfToken);
  }

  async call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const response = await this.context.fetch(path, {
      method,
      headers: { "x-csrf-token": this.csrf, ...headers },
      ...(body instanceof Buffer ? { data: body } : body === undefined ? {} : { data: body }),
    });
    const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: unknown };
    if (!response.ok()) {
      throw new Error(`${method} ${path} -> ${response.status()} ${JSON.stringify(payload.error)}`);
    }
    return payload.data as T;
  }

  async taxonomies() {
    const [categories, models] = await Promise.all([
      this.call<Taxonomy[]>("GET", "/api/v1/admin/categories"),
      this.call<Taxonomy[]>("GET", "/api/v1/admin/models"),
    ]);
    const category = categories[0];
    const model = models.find((entry) => entry.active !== false) ?? models[0];
    if (!category || !model) {
      throw new Error("seed categories and models first (pnpm db:seed)");
    }
    return { categoryId: category.id, modelId: model.id };
  }

  /** Creates `count` published prompts, one image each, through the real upload pipeline. */
  async createPublished(count: number, label: string): Promise<string[]> {
    const { categoryId, modelId } = await this.taxonomies();
    const files = await Promise.all(Array.from({ length: count }, (_, index) => pngBuffer((index * 37) % 360)));
    const batch = await this.call<{ items: Array<{ id: string; promptId: string }> }>(
      "POST",
      "/api/v1/admin/upload-batches",
      {
        mode: "multiple",
        defaults: { categoryId, modelId },
        items: files.map((file, index) => ({
          clientItemId: `${label}-${index}`,
          name: `${label}-${index}.png`,
          size: file.byteLength,
          type: "image/png",
        })),
      },
      { "idempotency-key": crypto.randomUUID() },
    );
    await Promise.all(
      batch.items.map((item, index) =>
        this.call("PUT", `/api/v1/admin/upload-items/${item.id}/file`, files[index], {
          "content-type": "image/png",
        }),
      ),
    );
    const ids = batch.items.map((item) => item.promptId);
    for (const [index, id] of ids.entries()) {
      const prompt = await this.waitForImages(id, 1);
      const saved = await this.call<{ version: number }>("PATCH", `/api/v1/admin/prompts/${id}`, {
        version: prompt.version,
        title: `${label} ${index + 1}`,
        promptText: `${label} fixture prompt ${index + 1}, soft gradient, studio light`,
      });
      await this.call("POST", `/api/v1/admin/prompts/${id}/publish`, { version: saved.version });
    }
    return ids;
  }

  async waitForImages(id: string, count: number): Promise<AdminPrompt> {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const prompt = await this.call<AdminPrompt>("GET", `/api/v1/admin/prompts/${id}`);
      if (prompt.assetItems.length >= count && prompt.assetItems.every((asset) => asset.status === "ready")) {
        return prompt;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`images for ${id} never became ready; is the worker running with STORAGE_DRIVER=fs?`);
  }

  async remove(ids: string[]) {
    for (const id of ids) {
      try {
        const prompt = await this.call<AdminPrompt>("GET", `/api/v1/admin/prompts/${id}`);
        await this.call("DELETE", `/api/v1/admin/prompts/${id}`, { version: prompt.version });
      } catch {
        // Already gone; cleanup is best effort.
      }
    }
  }

  async publishedTotal(): Promise<number> {
    const page = await this.call<{ total: number }>("GET", "/api/v1/admin/prompts?status=published&pageSize=1");
    return page.total;
  }

  dispose() {
    return this.context.dispose();
  }
}
