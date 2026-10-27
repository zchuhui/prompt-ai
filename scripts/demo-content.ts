/**
 * Publishes generated demo content through the real HTTP API of a running
 * local server (login, upload, worker processing, edit, publish).
 *
 * DEMO_ADMIN_USERNAME / DEMO_ADMIN_PASSWORD must belong to a local admin.
 * Never point this at production.
 */
import sharp from "sharp";
import { loadLocalEnv } from "../src/server/load-env";

loadLocalEnv();

const origin = process.env.DEMO_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
const username = process.env.DEMO_ADMIN_USERNAME ?? "editor";
const password = process.env.DEMO_ADMIN_PASSWORD;

if (!password) {
  throw new Error("DEMO_ADMIN_PASSWORD is required");
}
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
  throw new Error(`Refusing to write demo content to ${origin}`);
}

type Palette = [string, string, string];

type Demo = {
  title: string;
  summary: string;
  promptText: string;
  negativePrompt?: string;
  parametersText?: string;
  usageNotes?: string;
  aspectRatio: string;
  category: string;
  model: string;
  tags: string[];
  sizes: Array<[number, number]>;
  palette: Palette;
  requiresReference?: boolean;
  sourceType?: "original" | "collected";
  sourceAuthor?: string;
  sourceUrl?: string;
};

const demos: Demo[] = [
  {
    title: "霓虹雨夜的东方街巷",
    summary: "赛博朋克与传统牌坊结合的雨夜街景，适合手机壁纸。",
    promptText:
      "a narrow eastern alley at night, heavy rain, neon signs in cyan and violet,\nwet stone pavement reflections, paper lanterns, volumetric fog,\ncinematic composition, 35mm, high detail",
    negativePrompt: "text, watermark, blurry, low contrast",
    parametersText: "--ar 9:16 --style raw --stylize 250",
    aspectRatio: "9:16",
    category: "wallpaper",
    model: "midjourney",
    tags: ["eastern-mythology"],
    sizes: [[720, 1280], [720, 1280], [720, 1280]],
    palette: ["#0b1026", "#22d3ee", "#a78bfa"],
  },
  {
    title: "晨光里的龟背竹",
    summary: "柔和晨光下的室内植物，胶片质感。",
    promptText:
      "soft morning light through linen curtains, monstera leaves casting shadows,\npale plaster wall, film photograph, kodak portra 400, calm and minimal",
    aspectRatio: "3:4",
    category: "wallpaper",
    model: "gpt-image",
    tags: ["healing", "plant", "realistic"],
    sizes: [[768, 1024], [768, 1024]],
    palette: ["#0f2a1d", "#6ee7b7", "#fde68a"],
  },
  {
    title: "山海经 · 九尾狐海报",
    summary: "水墨与金箔结合的神话生物海报。",
    promptText:
      "nine-tailed fox from Shan Hai Jing, ink wash painting, gold leaf accents,\nswirling clouds, red seal stamp, vertical poster layout, elegant negative space",
    negativePrompt: "photorealistic, 3d render, extra limbs",
    aspectRatio: "2:3",
    category: "poster",
    model: "flux",
    tags: ["eastern-mythology"],
    sizes: [[800, 1200]],
    palette: ["#1a0b0b", "#f97316", "#fcd34d"],
    sourceType: "collected",
    sourceAuthor: "Studio Lumen",
    sourceUrl: "https://example.com/fox-poster",
  },
  {
    title: "玻璃质感 3D 角色设定",
    summary: "半透明材质的 Q 版角色三视图。",
    promptText:
      "cute chibi character turnaround sheet, front side back views,\nfrosted glass material, iridescent subsurface scattering, studio lighting,\nclean gradient background, 3d render, octane",
    parametersText: "steps: 30\ncfg: 5.5\nsampler: dpmpp_2m",
    usageNotes: "把 chibi character 换成你的角色描述，三视图结构保持不变。",
    aspectRatio: "16:9",
    category: "character",
    model: "flux",
    tags: ["3d"],
    sizes: [[1280, 720], [1280, 720]],
    palette: ["#0c1222", "#60a5fa", "#f0abfc"],
  },
  {
    title: "胶片人像 · 窗边午后",
    summary: "自然光人像，需要参考图控制人物长相。",
    promptText:
      "portrait of a young woman by the window, late afternoon sun,\nsoft rim light, shallow depth of field, 85mm f1.4, film grain, natural skin texture",
    negativePrompt: "plastic skin, oversharpened, heavy makeup",
    aspectRatio: "4:5",
    category: "portrait",
    model: "gpt-image",
    tags: ["realistic"],
    sizes: [[800, 1000]],
    palette: ["#1c1410", "#fb923c", "#fef3c7"],
    requiresReference: true,
    usageNotes: "上传一张正脸参考图，再粘贴这段提示词。",
  },
  {
    title: "极光下的雪山湖泊",
    summary: "宽幅风景，适合桌面壁纸。",
    promptText:
      "aurora borealis over a frozen alpine lake, snow-covered peaks,\nmirror reflection, long exposure, ultra wide, crisp night air",
    aspectRatio: "16:9",
    category: "wallpaper",
    model: "midjourney",
    tags: ["healing"],
    sizes: [[1280, 720]],
    palette: ["#020617", "#34d399", "#818cf8"],
  },
  {
    title: "敦煌飞天 · 数字壁画",
    summary: "飘带与祥云的竖幅数字壁画。",
    promptText:
      "flying apsaras from Dunhuang murals, flowing ribbons, auspicious clouds,\nmineral pigments, turquoise and ochre palette, digital mural, intricate linework",
    aspectRatio: "3:4",
    category: "poster",
    model: "gpt-image",
    tags: ["eastern-mythology"],
    sizes: [[768, 1024], [768, 1024], [768, 1024], [768, 1024]],
    palette: ["#0f172a", "#2dd4bf", "#f59e0b"],
  },
  {
    title: "多肉植物微距",
    summary: "露珠与多肉叶片的微距特写。",
    promptText:
      "macro photograph of succulent rosette, morning dew drops,\nsoft pastel gradient background, shallow depth of field, 100mm macro",
    aspectRatio: "1:1",
    category: "wallpaper",
    model: "flux",
    tags: ["plant", "healing", "realistic"],
    sizes: [[1024, 1024]],
    palette: ["#14261c", "#a3e635", "#f9a8d4"],
  },
  {
    title: "机甲少女 · 角色立绘",
    summary: "硬表面机甲与少女角色的立绘。",
    promptText:
      "mecha girl character art, hard surface armor panels, glowing cyan joints,\ndynamic pose, clean white background, concept art, sharp lineart",
    negativePrompt: "lowres, bad anatomy, extra fingers",
    aspectRatio: "2:3",
    category: "character",
    model: "midjourney",
    tags: ["3d"],
    sizes: [[800, 1200], [800, 1200]],
    palette: ["#0a0f1f", "#22d3ee", "#e2e8f0"],
  },
  {
    title: "复古科幻电影海报",
    summary: "70 年代风格的太空歌剧海报。",
    promptText:
      "retro 1970s sci-fi movie poster, giant ringed planet, lone astronaut,\nairbrushed gradients, halftone texture, bold title space at top",
    aspectRatio: "2:3",
    category: "poster",
    model: "gpt-image",
    tags: [],
    sizes: [[800, 1200]],
    palette: ["#1e0b2e", "#f472b6", "#fde047"],
  },
  {
    title: "云海之上的空中庭院",
    summary: "悬浮岛屿与中式庭院的奇幻场景。",
    promptText:
      "floating island with a chinese courtyard above a sea of clouds,\npavilion, waterfall falling into mist, golden hour, matte painting",
    aspectRatio: "4:3",
    category: "wallpaper",
    model: "flux",
    tags: ["eastern-mythology", "healing"],
    sizes: [[1024, 768]],
    palette: ["#0b1324", "#93c5fd", "#fbbf24"],
  },
  {
    title: "工作室产品人像",
    summary: "高调棚拍，干净背景。",
    promptText:
      "studio portrait, high key lighting, seamless light gray backdrop,\nsoft beauty dish, editorial fashion, minimal styling, medium format",
    aspectRatio: "4:5",
    category: "portrait",
    model: "midjourney",
    tags: ["realistic"],
    sizes: [[800, 1000], [800, 1000]],
    palette: ["#111827", "#cbd5e1", "#f8fafc"],
  },
];

function svgArt([base, glow, accent]: Palette, width: number, height: number, seed: number): string {
  const rand = (n: number) => {
    const x = Math.sin(seed * 999 + n * 77.7) * 10000;
    return x - Math.floor(x);
  };
  const circles = Array.from({ length: 7 }, (_, index) => {
    const cx = Math.round(rand(index) * width);
    const cy = Math.round(rand(index + 10) * height);
    const r = Math.round((0.12 + rand(index + 20) * 0.35) * Math.max(width, height));
    const color = index % 2 === 0 ? glow : accent;
    const opacity = (0.18 + rand(index + 30) * 0.35).toFixed(2);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#g${index % 2})" opacity="${opacity}" style="mix-blend-mode:screen" data-c="${color}"/>`;
  }).join("");
  const ridge = Array.from({ length: 9 }, (_, index) => {
    const x = Math.round((index / 8) * width);
    const y = Math.round(height * (0.62 + rand(index + 40) * 0.18));
    return `${x},${y}`;
  }).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${base}"/><stop offset="1" stop-color="#000"/>
    </linearGradient>
    <radialGradient id="g0"><stop offset="0" stop-color="${glow}"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
    <radialGradient id="g1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  ${circles}
  <polygon points="0,${height} ${ridge} ${width},${height}" fill="#000" opacity="0.55"/>
  <rect width="100%" height="100%" fill="none" stroke="${glow}" stroke-opacity="0.15" stroke-width="2"/>
</svg>`;
}

class Client {
  private cookie = "";
  csrf = "";

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("origin", origin);
    if (this.cookie) headers.set("cookie", this.cookie);
    if (this.csrf) headers.set("x-csrf-token", this.csrf);
    if (init.body && typeof init.body === "string") headers.set("content-type", "application/json");
    const response = await fetch(`${origin}${path}`, { ...init, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0] ?? "";
    const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: unknown };
    if (!response.ok) {
      throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status} ${JSON.stringify(payload.error)}`);
    }
    return payload.data as T;
  }

  async login() {
    await this.request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    const session = await this.request<{ csrfToken: string }>("/api/v1/auth/session");
    this.csrf = session.csrfToken;
  }
}

type Taxonomy = { id: string; slug: string };

async function main() {
  const client = new Client();
  await client.login();
  const [categories, models, tags] = await Promise.all([
    client.request<Taxonomy[]>("/api/v1/admin/categories"),
    client.request<Taxonomy[]>("/api/v1/admin/models"),
    client.request<Taxonomy[]>("/api/v1/admin/tags"),
  ]);
  const idOf = (rows: Taxonomy[], slug: string) => {
    const found = rows.find((row) => row.slug === slug);
    if (!found) throw new Error(`Missing taxonomy ${slug}; run pnpm db:seed first`);
    return found.id;
  };

  const published: string[] = [];
  for (const [index, demo] of demos.entries()) {
    const files = await Promise.all(
      demo.sizes.map(([width, height], position) =>
        sharp(Buffer.from(svgArt(demo.palette, width, height, index * 10 + position + 1)))
          .png()
          .toBuffer(),
      ),
    );
    const batch = await client.request<{
      batchId: string;
      items: Array<{ id: string; promptId: string }>;
    }>("/api/v1/admin/upload-batches", {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        mode: "single",
        defaults: {
          categoryId: idOf(categories, demo.category),
          modelId: idOf(models, demo.model),
          tagIds: demo.tags.map((slug) => idOf(tags, slug)),
        },
        items: files.map((file, position) => ({
          clientItemId: `demo-${index}-${position}`,
          name: `demo-${index}-${position}.png`,
          size: file.byteLength,
          type: "image/png",
        })),
      }),
    });
    for (const [position, item] of batch.items.entries()) {
      const file = files[position];
      if (!file) continue;
      await client.request(`/api/v1/admin/upload-items/${item.id}/file`, {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: new Uint8Array(file),
      });
    }
    const promptId = batch.items[0]?.promptId;
    if (!promptId) throw new Error("batch has no prompt");

    let prompt: { version: number; assetItems: Array<{ status: string }> } | undefined;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const current = await client.request<{ version: number; assetItems: Array<{ status: string }> }>(
        `/api/v1/admin/prompts/${promptId}`,
      );
      prompt = current;
      if (current.assetItems.length === files.length && current.assetItems.every((a) => a.status === "ready")) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!prompt || prompt.assetItems.some((asset) => asset.status !== "ready")) {
      throw new Error(`images for ${demo.title} did not become ready; is the worker running with the same storage?`);
    }
    const saved = await client.request<{ version: number }>(`/api/v1/admin/prompts/${promptId}`, {
      method: "PATCH",
      body: JSON.stringify({
        version: prompt.version,
        title: demo.title,
        summary: demo.summary,
        promptText: demo.promptText,
        negativePrompt: demo.negativePrompt ?? null,
        parametersText: demo.parametersText ?? null,
        usageNotes: demo.usageNotes ?? null,
        aspectRatio: demo.aspectRatio,
        requiresReference: demo.requiresReference ?? false,
        sourceType: demo.sourceType ?? "original",
        sourceAuthor: demo.sourceAuthor ?? null,
        sourceUrl: demo.sourceUrl ?? null,
      }),
    });
    await client.request(`/api/v1/admin/prompts/${promptId}/publish`, {
      method: "POST",
      body: JSON.stringify({ version: saved.version }),
    });
    published.push(promptId);
    console.log(`published ${demo.title}`);
  }

  const collection = await client.request<{ id: string; version: number }>("/api/v1/admin/collections", {
    method: "POST",
    body: JSON.stringify({ title: "东方幻想", description: "神话、壁画与云海，东方题材的提示词合集。" }),
  });
  await client.request(`/api/v1/admin/collections/${collection.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      version: collection.version,
      status: "published",
      promptIds: [published[0], published[2], published[6], published[10]].filter(Boolean),
    }),
  });
  const second = await client.request<{ id: string; version: number }>("/api/v1/admin/collections", {
    method: "POST",
    body: JSON.stringify({ title: "治愈系壁纸", description: "植物、晨光与极光，适合做手机和桌面壁纸。" }),
  });
  await client.request(`/api/v1/admin/collections/${second.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      version: second.version,
      status: "published",
      promptIds: [published[1], published[5], published[7]].filter(Boolean),
    }),
  });
  console.log(`done: ${published.length} prompts, 2 collections`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
