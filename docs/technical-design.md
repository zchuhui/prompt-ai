# Prompt Gallery 技术设计与 AI 开发执行规范

版本：1.0 · 2026-10-26  
需求依据：[产品需求文档](./prompt-gallery-prd.md)  
状态：待实施。本文件定义目标结构、接口和实现顺序，不表示这些文件或命令已经存在。

## 1. 架构决策

采用单仓库、模块化单体：Next.js 同时承载前台、后台与 HTTP API，PostgreSQL 保存业务数据，私有 S3 兼容对象存储保存图片。独立 Node Worker 处理图片，但与 Web 共用代码和数据库。默认 Docker Compose 自托管，适用于已有 Linux/Docker 环境；不以受请求体与执行时长限制的 Serverless 作为第一版部署目标。

不引入独立 Go API、微服务、Redis、向量数据库或大型 Monorepo。后台没有访客用户体系，仅一个管理员账号。未来拆分服务需另写 ADR，不在第一版预建抽象。

| 层 | 选型 | 约束 |
|---|---|---|
| 运行时 | Node.js 24 LTS、pnpm 10 | 初始化时核对受支持补丁版本，固定精确版本 |
| Web | Next.js 16 App Router、兼容的 React 19 | TypeScript strict；Node runtime；不使用 Edge runtime |
| UI | Tailwind CSS 4、shadcn/ui、Lucide | 组件源码归项目；可访问性优先 |
| 表单 | React Hook Form、Zod | 服务端重新验证，不能只依赖浏览器 |
| 数据 | PostgreSQL 17、Drizzle ORM、pg | code-first schema + SQL migration；禁止生产 db push |
| 对象存储 | AWS SDK v3 S3 接口 | 开发用 MinIO；生产可用私有 S3 兼容服务 |
| 图片 | Sharp | Worker 解码、去元数据、生成 WebP 衍生图 |
| 任务 | PostgreSQL 持久任务表 | 租约、重试、幂等，不用进程内临时队列 |
| 测试 | Vitest、Testing Library、Playwright | 真实 PostgreSQL 集成测试与关键 E2E |
| 部署 | Docker Compose + Caddy | HTTPS、数据库持久卷、对象存储、Web 与 Worker |

上表是项目选型而非“最新版本”承诺。初始化时查官方兼容要求与安全更新，把实际版本固定在 package.json、packageManager、.node-version、镜像标签和 pnpm-lock.yaml；不得在 CI 使用 latest、canary 或无锁安装。除重大兼容问题外，不自行改换技术栈。

## 2. AI 编码协作规则

不存在所有 AI 工具共用的唯一目录标准。这里使用通用工程约束：根目录 AGENTS.md 作为编码入口，文档保留决策，任务具备清晰边界，代码有可运行验证。

### 2.1 上下文与事实来源

AI 开始任务依次读取：用户当前要求 → 根 AGENTS.md 与目标目录适用规则 → 本 PRD → 本技术设计 → 当前任务文档 → 相关代码与测试。发生冲突时明确指出；不靠猜测修改产品范围。代码与文档不一致时记录差异并修正，不能把未运行的验证写成通过。

根 AGENTS.md 应在初始化任务创建，保持简短，包含：项目目标、包管理器、启动/检查命令、模块依赖方向、权限规则、迁移要求、文档入口和完成标准。它不是产品长文，也不包含密钥。若同时支持 Claude/Cursor，仅建立指向 AGENTS.md 的短入口说明，不复制多份会漂移的规则。任务恢复记录写 docs/tasks，不放在系统提示文件中。

### 2.2 编码规范

- 文件 kebab-case；React 导出组件 PascalCase；函数 camelCase；表名 snake_case。
- 使用 @/ 指向 src/。客户端不能导入数据库、存储、认证或服务端环境变量；所有 server 文件显式 import 'server-only'（Worker 共用的纯基础设施需单独模块，避免依赖 Next 专属标记）。
- 路由文件只负责解析输入、鉴权、调用 service 和格式化输出。事务与业务约束在 service；SQL 在 repository；共享 schema 不导入服务端依赖。
- 依赖方向：app → features → server/shared。features 之间通过公开 service/types 调用，禁止循环依赖与跨模块访问内部 repository。
- 不把所有代码塞入 page.tsx、utils.ts 或一个巨型 service。按职责拆分，不为行数强行拆组件。
- Zod 推导请求类型，Drizzle 推导数据库类型，DTO 显式映射；不重复维护三份同义实体，不向客户端返回整行数据库记录。
- 禁止 any、忽略类型错误、关闭 lint 作为解决方案；异常需要业务错误码，不静默吞掉。
- 不修改历史已应用 migration；数据库变更生成新 migration，提交 schema 与 SQL。
- 不自动升级依赖、重写无关模块、提交密钥或覆盖用户改动。
- 任务完成须说明修改、实际验证、已知限制；未完成项留在任务文件，不伪造可用状态。

## 3. 目标目录

```text
prompt-ai/
  AGENTS.md
  README.md
  package.json
  pnpm-lock.yaml
  .node-version
  .env.example
  .gitignore
  .dockerignore
  .github/workflows/ci.yml
  next.config.ts
  tsconfig.json
  eslint.config.mjs
  drizzle.config.ts
  vitest.config.ts
  playwright.config.ts
  components.json
  Dockerfile
  compose.yaml
  docs/
    prompt-gallery-prd.md
    technical-design.md
    adr/                         # 有实质取舍时才创建
    tasks/                       # 每个任务独立文件，记录状态和验收
    runbooks/                    # 部署、备份恢复与故障处理
  drizzle/                       # 已审查的迁移 SQL 与生成元数据
  scripts/
    seed.ts
    create-admin.ts
    reset-admin-password.ts
  infra/
    Caddyfile
    minio-init.sh
  public/
    brand/                       # 仅版本化品牌静态资源，不放用户上传
  src/
    app/
      layout.tsx
      globals.css
      error.tsx
      not-found.tsx
      robots.ts
      sitemap.ts
      (public)/
        page.tsx
        prompts/[slug]/page.tsx
        collections/page.tsx
        collections/[slug]/page.tsx
        about/page.tsx
      admin/
        login/page.tsx
        (protected)/
          layout.tsx
          page.tsx
          prompts/page.tsx
          prompts/new/page.tsx
          prompts/[id]/edit/page.tsx
          prompts/[id]/preview/page.tsx
          uploads/page.tsx
          taxonomies/page.tsx
          collections/page.tsx
          collections/[id]/edit/page.tsx
      api/v1/
        auth/                    # login/logout/session
        prompts/                 # 公开接口
        collections/
        filters/
        media/[id]/[variant]/
        events/
        admin/                   # CRUD、batch、uploads、预览媒体
      api/health/
    features/
      prompts/
        components/
        schemas.ts
        types.ts
        server/queries.ts
        server/service.ts
        server/repository.ts
      uploads/                   # 同样按 components/schema/server 分层
      collections/
      taxonomies/
      auth/
      analytics/
    components/
      ui/
      layout/
    shared/
      constants.ts
      errors.ts
      pagination.ts
    server/
      db/client.ts
      db/schema/                 # 按业务实体拆分
      env.ts
      storage.ts
      logger.ts
      security.ts
      jobs.ts
    workers/
      index.ts
      process-image.ts
      cleanup-assets.ts
  tests/
    integration/
    e2e/
    fixtures/                    # 小尺寸合法图片与测试数据
```

单元测试可紧邻源码放 *.test.ts(x)。不要预建大量空目录或占位实现，随任务创建。Worker 通过 tsx 开发运行、tsup 构建独立产物；构建时明确 external sharp/pg，生产镜像安装匹配 Linux 的原生依赖，不复制 Windows node_modules。

## 4. 页面、渲染与状态

公开首页、详情、合集使用 Server Components 渲染，数据库查询直接调用公开查询函数，不从服务器 HTTP 请求自身 API。交互筛选、复制、大图、上传编辑器才使用 Client Components。

第一版所有业务页面和公开 JSON 数据使用动态读取，不开启持久数据缓存或 ISR；后台及媒体响应 no-store。这牺牲部分 CDN 命中率，换取撤回和修改后立即生效的明确语义。后续引入缓存必须同步实现撤回失效测试。

首页 URL：`/?q=龙&category=landscape&model=gpt-image&tags=healing,3d&page=1`。默认 page=1、pageSize=24，上限 48；排序 published_at DESC,id DESC。加载更多链接对应真实分页 URL，JS 增强为追加卡片；无 JS 时仍能翻页。页面历史保存已加载页和 scrollY，返回时恢复；筛选变化重置为第一页。第一页及后续页均 SSR，可直接访问。offset 分页允许并发发布时顺序变化，客户端追加按 id 去重。

瀑布流使用 CSS Grid 行跨度测量方案：DOM 保持行优先顺序；以数据库宽高设置 aspect-ratio 占位，ResizeObserver 更新跨度；不使用 grid-auto-flow:dense 打乱键盘顺序。网格初始为 `data-masonry="pending"`，按普通行高布局，客户端测量完成后切换为 `ready`，避免脚本运行前卡片重叠。小屏 2 列、768px 起 3 列、1024px 起 4 列、1440px 起 5 列。卡片限制极端长图高度并用 object-fit:contain 保留完整画面。

视觉 token（T10 起为深色）：背景 #07080A、表面 #0E1014 / #151820、边框 #1F232B / #2C323D、正文 #E6E8EB、次级文字 #8A919E、强调色 #22D3EE、点缀色 #A78BFA、强调色上的文字 #041014；内容最大宽度 1600px。元信息使用系统等宽字体栈，不下载网络字体。触摸目标至少 44px；轮播有按钮与键盘操作，弹层锁定焦点并支持 Esc。使用系统中文字体，避免首次访问下载巨大中文字体包。

所有异步界面提供 loading/error/empty/retry；复制直接使用存储原文，不 trim 或格式化正文。剪贴板失败展示只读可选择文本。参数、负面 Prompt 独立复制。

## 5. 数据模型与约束

所有业务 id 使用 UUID；时间使用 timestamptz，数据库统一 UTC；展示按浏览器时区。内容 title/prompt 等文本允许空串以保存草稿，发布时严格验证。外键、唯一性、状态枚举与关键 check 必须进入 migration，不仅写在 TS。

| 表 | 核心字段 / 约束 |
|---|---|
| admins | id, username 唯一, password_hash, created_at；初始化脚本限制单管理员 |
| sessions | token_hash 主键, admin_id FK, expires_at, created_at；不存明文 token |
| prompts | id, slug 唯一且不可自动变更, title, summary, prompt_text, negative_prompt, usage_notes, parameters_text, model_version, aspect_ratio, requires_reference 默认 false, source_type original/collected, source_author, source_url, category_id nullable FK RESTRICT, model_id nullable FK RESTRICT, status draft/published, cover_asset_id nullable FK, version int 默认 1, created_at, updated_at, published_at nullable, deleted_at nullable |
| categories | id, name, normalized_name 唯一, slug 唯一, sort_order |
| tags | id, name, normalized_name 唯一, slug 唯一 |
| models | id, name, normalized_name 唯一, slug 唯一, description, active, sort_order |
| prompt_tags | prompt_id, tag_id；复合主键；关联删除 CASCADE |
| assets | id, status uploading/queued/processing/ready/failed, original_key 唯一, card_key, detail_key, mime_type, byte_size, width, height, checksum, error_code, created_at, ready_at |
| prompt_assets | prompt_id, asset_id, position, alt；复合主键；UNIQUE(prompt_id,position) |
| collections | id, slug 唯一, title, description, cover_asset_id nullable, status draft/published, version, created_at, updated_at |
| collection_prompts | collection_id, prompt_id, position；复合主键，UNIQUE(collection_id,position) |
| upload_batches | id, mode single/multiple, defaults jsonb, created_at, admin_id |
| upload_items | id, batch_id FK, client_item_id, asset_id nullable, prompt_id nullable, status pending/uploading/processing/ready/failed, error_code；UNIQUE(batch_id,client_item_id) |
| jobs | id, type, payload jsonb, dedupe_key 唯一, status queued/running/done/failed, attempts, run_at, locked_until, lease_token, last_error, created_at |
| idempotency_keys | admin_id, key, request_hash, response jsonb, expires_at；复合唯一 |
| rate_limits | key_hash, window_start, count；复合主键，定期清理 |
| analytics_events | id, event_id 唯一, kind, prompt_id nullable, path, query_text nullable, created_at |
| audit_logs | id, admin_id, action, entity_type, entity_id, request_id, created_at；不记录 Prompt 全文和密码 |

normalized_name 使用 NFKC、去两侧空白、小写。slug 自动用可读前缀加随机短标识生成，中文标题可退化为 p-短标识；冲突时重试。链接不随标题自动修改。首次发布前（published_at 为空）管理员可以手动修改 slug，格式为小写字母、数字和连字符，3–80 字符，冲突返回 409；首次发布后再修改返回 422。

索引：prompts(status,published_at DESC,id DESC) WHERE deleted_at IS NULL；category_id/model_id；prompt_tags(tag_id,prompt_id)；collection_prompts(prompt_id)；jobs(status,run_at)；sessions(expires_at)；assets(status,created_at)。

### 5.1 发布与更新事务

服务端发布校验：标题 1–120 字符，主 Prompt 1–50000 字符，至少 1 张且最多 20 张 ready 图片，分类及模型存在，封面属于该条图片列表；新发布时模型必须 active。停用模型不隐藏既有内容。图片未完成处理不能发布。

PATCH 必须携带 version，通过 `UPDATE ... WHERE id=? AND version=?` 乐观锁更新，成功 version+1，冲突 409。已发布内容的编辑也执行完整发布校验，不能通过删除最后一张图等方式留下无效公开内容。所有关联替换、排序、状态和封面在同一事务；删除封面默认选择剩余第一张。重排序使用事务内删除重插关系或可延迟唯一约束，避免临时位置冲突。

首次发布设置 published_at；撤回不清除它，再发布保留原排序时间。撤回将 status 改 draft；删除设置 deleted_at 并撤回。公开查询统一要求 status=published AND deleted_at IS NULL。删除标签只删关联；删除分类/模型有引用返回 409，先显式迁移。

复制草稿共享已有 immutable asset 引用，不重复复制存储对象；之后替换图片创建新 asset。物理清理前检查全部存活引用，不能因删除一个副本而破坏其他内容。

合集公开时仅返回公开且未删除的成员。合集封面必须来自其公开成员的 ready 图片；原封面失效时自动选第一个有效成员封面；没有公开成员时合集不出现在列表，详情返回 404。合辑排序同样事务写入。

### 5.2 搜索实现

第一版采用参数化 SQL：标题、简介、正文 ILIKE 子串匹配，或通过 EXISTS 匹配标签名称。q 最多 100 字符，作为完整子串处理；转义 %、_、反斜杠，避免意外变通配符。分类、模型与搜索取 AND；tags 内通过 IN + EXISTS 实现 OR，避免 JOIN 重复卡片。

第一版不承诺中文分词或语义搜索。先以 1 万条内容进行压测；普通 B-tree 不能优化前置 %，达到瓶颈再用 ADR 引入 pg_trgm 或专门中文搜索。不能把英文全文检索配置当作中文搜索解决方案。

## 6. API 合约

前缀 /api/v1；JSON 字段 camelCase。响应成功为 `{data, meta?}`；失败为 `{error:{code,message,fields?,requestId}}`。状态码：400 输入非法、401 未登录、403 CSRF/权限拒绝、404 不存在或不可公开、409 版本/引用冲突、413 太大、415 格式不支持、422 发布条件不足、429 限流、500 未知错误。500 不泄露堆栈或 SQL。

| 方法与路径 | 输入与行为 |
|---|---|
| GET /prompts | q,category,model,tags,page,pageSize；返回卡片 DTO 与 total/page/hasMore |
| GET /prompts/:slug | 已发布详情、ready 图片、标签、最多 8 条相关推荐 |
| GET /filters | 分类、标签、模型；不泄露草稿计数 |
| GET /collections | 已发布且有公开成员的合集 |
| GET /collections/:slug | 合集信息、按 position 排序的公开成员；分页 |
| GET /media/:id/:variant | variant=card/detail/original；按第 8 节授权返回图片 |
| POST /auth/login | username,password；创建 session 和 Cookie |
| POST /auth/logout | 撤销当前 session，清 Cookie |
| GET /auth/session | 管理员最小信息、CSRF token；no-store |
| GET /admin/prompts | 标题、状态、分类、模型、分页；含草稿 |
| POST /admin/prompts | 创建空草稿；支持 Idempotency-Key |
| GET /admin/prompts/:id | 编辑/预览 DTO，必须鉴权 |
| PATCH /admin/prompts/:id | 标量字段、tagIds、assetItems、coverAssetId、version；状态单独变更 |
| DELETE /admin/prompts/:id | 带 version，软删除并撤回 |
| POST /admin/prompts/:id/publish | version；发布校验和状态变更 |
| POST /admin/prompts/:id/unpublish | version；撤回 |
| POST /admin/prompts/:id/duplicate | 创建新 slug 草稿，共享图片引用 |
| POST /admin/prompts/batch | action publish/unpublish/delete，items:[{id,version}]，最多 100 项 |
| POST /admin/upload-batches | mode、items:[{clientItemId,name,size,type}]、defaults；返回 batchId/items |
| PUT /admin/upload-items/:id/file | 原始二进制文件流，Content-Type；非 base64；单文件请求 |
| POST /admin/upload-items/:id/retry | 对处理失败项重新入队；传输失败重新 PUT 文件 |
| GET /admin/upload-batches/:id | 获取每项状态、关联草稿及错误 |
| GET /admin/media/:id/:variant | 登录后读取任意未清理图片；no-store |
| GET/POST /admin/categories,tags,models | 三组独立路由；列表、新增 |
| PATCH/DELETE /admin/categories/:id | 更新或删除；引用保护 |
| PATCH/DELETE /admin/tags/:id | 更新或删除标签与关联 |
| PATCH/DELETE /admin/models/:id | 更新、停用或删除；引用保护 |
| GET/POST /admin/collections | 列表/新建草稿合集 |
| GET/PATCH/DELETE /admin/collections/:id | 带 version 更新内容、排序、封面与 status；删除合集不删 Prompt |
| POST /events | eventId,kind,promptId?,path,query?；验证后 202 |

批量操作每条独立事务，返回 `{data:{results:[{id,ok,version?,error?}]}}`，整体 200 表示已处理而非全部成功。无效 action 或过多项直接 400。禁止 Promise.all 无限制并发。

示例编辑请求：

```json
{
  "version": 3,
  "title": "治愈系植物壁纸",
  "promptText": "第一行提示词\n第二行提示词",
  "categoryId": "uuid",
  "modelId": "uuid",
  "tagIds": ["uuid"],
  "assetItems": [{"assetId": "uuid", "position": 0, "alt": "仰拍荷叶与蓝天"}],
  "coverAssetId": "uuid",
  "sourceType": "original"
}
```

字段长度：summary 500、negativePrompt/usageNotes/parametersText 各 10000、sourceAuthor 120、sourceUrl 2048、alt 300；tagIds 最多 20，全部数组去重并校验外键。URL 只允许 http/https，渲染外链使用 noreferrer/noopener。正文纯文本显示，不渲染用户 HTML。

## 7. 管理员认证与安全边界

管理员使用一次性 CLI 初始化，密码通过交互式隐藏输入获取，不写命令参数或提交默认密码。使用 Argon2id 密码库生成带参数的哈希，配置经目标服务器基准测量；重置密码脚本同时删除所有 sessions。

登录成功生成 32 字节加密随机 token，数据库仅存 SHA-256(token)，8 小时绝对到期。生产 Cookie 名 __Host-pg-session，Secure、HttpOnly、SameSite=Lax、Path=/、不设 Domain；开发 HTTP 用 pg-session，不能在生产关闭 Secure。退出删除数据库会话并清 Cookie。

每个 admin handler、预览查询与变更 service 必须验证会话。layout 或 proxy 的跳转仅是体验优化，不充当唯一鉴权。认证上下文必须由服务端构造，不能从客户端接受 adminId。

登录和所有变更请求校验 Origin 与 APP_URL 精确同源；登录外，变更请求还需 X-CSRF-Token（由 session token 派生的 HMAC 值，用 CSRF_SECRET，常量时间比较）。Cookie 请求禁止跨域宽泛 CORS。登出同样受保护。

登录按 IP 哈希 + 用户名限速：15 分钟最多 5 次失败，返回统一错误消息，不泄露账号存在性；限流落 PostgreSQL，重启不清空。代理只信任自己控制的 Caddy 传入的真实 IP，不能直接信任任意 X-Forwarded-For。

后台、认证、预览和媒体设置 Cache-Control:no-store。日志不得包含密码、Cookie、签名密钥、Prompt 正文或上传二进制。建立 CSP（生产禁用 unsafe-eval）、nosniff 与同源策略，具体 CSP 在构建后验证 Next 脚本兼容性。

## 8. 上传、图片处理与撤回语义

### 8.1 上传流程

1. POST 创建批次，验证最多 100 项，single 模式最多 20 项；前端为每项生成稳定 clientItemId。服务端在事务中创建批次、条目与目标草稿；single 共享一个草稿，multiple 每项一个草稿。
2. 浏览器通过 XMLHttpRequest 上传二进制以获得进度，最多 3 个并发。PUT 流经 Web 到私有对象存储临时 key；按实际字节计数，超过 20 MiB 立即中止并清理，不信任 Content-Length。
3. 写完存储后，用数据库事务记录 asset 并创建 image job；缺少 DB 记录的临时对象由日常清理任务删除。返回 202，前端显示处理中。
4. Worker 使用 Sharp 检查真实文件类型、尺寸与解码有效性。只收 JPEG/PNG/WebP 静态图，拒绝动画和 SVG；像素总量上限 40 MP，坏文件进入 failed。
5. 应用 EXIF 方向、去除 EXIF/GPS；保留私有上传源文件用于处理重试。公开 original 是去元数据后的全尺寸展示版，不公开源文件字节。生成长边最大 640px 的 card、1920px 的 detail 和全尺寸展示版，不放大小图。
6. 三个衍生对象全部写入成功后，事务置 ready，关联草稿、按原始条目位置排序、设置默认封面，完成 job；随后 UI 可预览。失败显示具体可处理的错误码。

前端批次状态每 2 秒轮询，标签页隐藏时暂停；超过 60 秒可提示稍后返回但不宣布失败。刷新可通过 batchId 恢复服务端已接收的进度；浏览器未上传的文件不能凭空恢复，必须让用户重新选文件，并按条目验证大小与校验和。第一版不做分片断点续传。

### 8.2 幂等、租约与清理

创建批次和草稿支持 Idempotency-Key，保留 24 小时；同 key 同 body 返回原结果，不同 body 返回 409。PUT 同一 item 用锁防止并发覆盖，已接收成功返回已有状态；传输失败可重新上传，不重复创建草稿。处理重试复用 asset，job dedupe_key 避免重复入队。

Worker 通过事务 `FOR UPDATE SKIP LOCKED` 领取任务，租约 120 秒、每 30 秒续租；更新必须匹配 lease_token，过期 worker 不得提交结果。处理并发默认 2；重试间隔 10/60/300 秒，最多 3 次尝试，格式错误不自动重试。衍生 key 使用 assetId + 处理版本，写入可重复执行。

每日清理：24 小时前无数据库记录的临时上传；7 天前无存活 Prompt/合集引用且非处理中 asset；30 天前软删内容。先从媒体可见性查询排除，再删除对象；对象删除失败保留可重试清理任务。共享 asset 必须引用检查。生产持久任务运行由 Worker 负责，不依赖访问页面触发。

### 8.3 图片权限

对象存储桶始终私有，不把上传目录放 public/，不返回可长期访问的 bucket URL。公开 /media 在每次请求时检查图片是否属于至少一个当前公开、未删除的 Prompt；否则 404。后台媒体要求会话。

媒体由服务器流式返回，Cache-Control:no-store，Caddy 不缓存。不要通过 Next 默认图片优化缓存代理这些受状态控制的图片：使用 img + 显式 width/height/srcset/sizes，直接引用上述尺寸路由。否则撤回正文后可能仍能从优化缓存访问图片。

撤回后新的正文和媒体请求均受最新状态控制；已下载到用户设备的文件无法撤销。如果同一 asset 仍用于另一个公开内容，它仍可公开，这是共享引用的预期语义。未来 CDN 方案必须明确撤回时限及 purge 策略，不能悄悄改变此约定。

## 9. SEO 与统计

详情 generateMetadata 使用稳定 canonical、标题、简介和可访问的 detail 封面；结构化数据只表达实际存在的 CreativeWork/ImageObject 信息，不伪造评价或作者。站点地图只查询公开详情和有效合集，随请求生成；大量内容后再分片。

首页与详情可索引；q/category/model/tags 筛选结果 noindex,follow，规范化 query 顺序。分页无筛选页可独立访问，canonical 指向自身。admin/login/预览全部 noindex，同时依靠权限保护，robots 不是保密措施。

统计事件固定 page_view/detail_view/prompt_copy/search/search_empty；客户端生成 eventId 去重。复制事件仅在复制成功后发送；管理页面不发送。服务端验证 promptId 仍公开，限制 path 长度与事件体 2 KB。每 IP 哈希每分钟 60 次，超过返回 429；不将原始 IP 落业务统计表。query 最多 100 字符，不收集密码、正文或任意事件字段。统计数据保留 90 天；UI 只展示“粗略事件次数”，不声称为独立用户数。

## 10. 环境配置与本地运行契约

.env.example 仅包含说明和本地占位值，生产凭据通过部署环境提供：

```dotenv
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://prompt:local-only@localhost:5432/prompt_gallery
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=prompt-gallery
S3_ACCESS_KEY_ID=replace-local-key
S3_SECRET_ACCESS_KEY=replace-local-secret
S3_FORCE_PATH_STYLE=true
CSRF_SECRET=replace-with-random-secret
RATE_LIMIT_SECRET=replace-with-random-secret
LOG_LEVEL=info
WORKER_CONCURRENCY=2
```

server/env.ts 用 Zod 启动校验；服务端密钥禁止 NEXT_PUBLIC_ 前缀。容器内 DB 与 S3 地址使用服务名 postgres/minio，不能使用 localhost。Compose 凭据来自环境变量；.env* 忽略，但明确允许 .env.example。

初始化实现必须提供以下 scripts，随后 README 使用相同命令：

| 命令 | 实际目标 |
|---|---|
| pnpm dev | next dev |
| pnpm worker:dev | tsx watch src/workers/index.ts |
| pnpm build | next build + tsup Worker 生产构建 |
| pnpm start | 启动 standalone Web；正确复制 public 与 .next/static |
| pnpm worker:start | node dist/worker/index.js |
| pnpm lint | eslint .，不能依赖 next lint |
| pnpm typecheck | tsc --noEmit |
| pnpm test | vitest run，单元测试 |
| pnpm test:integration | 指向独立测试数据库的集成测试配置 |
| pnpm test:e2e | Playwright，启动 Web、Worker 与独立测试依赖 |
| pnpm db:generate | drizzle-kit generate |
| pnpm db:migrate | drizzle-kit migrate |
| pnpm db:seed | tsx scripts/seed.ts，幂等开发种子 |
| pnpm admin:create | tsx scripts/create-admin.ts，交互输入 |
| pnpm admin:reset | tsx scripts/reset-admin-password.ts |
| pnpm check | lint + typecheck + test + build |

在初始化任务完成后，本地顺序应为：安装固定 Node/pnpm → pnpm install --frozen-lockfile → 复制 .env.example 为 .env.local 并填写 → docker compose up -d postgres minio minio-init → pnpm db:migrate → pnpm db:seed → pnpm admin:create → 分别运行 pnpm dev 与 pnpm worker:dev。数据库脚本和 Worker 需显式加载 .env.local（Next 之外不会自动采用相同加载规则）。

项目当前有 docs，初始化不能用脚手架覆盖目录。在临时目录生成框架模板后只合并所需文件，保留所有已有文档及用户文件。第一版 seed 创建分类、标签、模型和测试草稿，不把网络随意下载的图片作为真实内容发布。

## 11. 测试与完成门槛

| 层级 | 必测场景 |
|---|---|
| 单元 | 发布校验、筛选语义、URL 规范化、版本冲突、状态转换 |
| 数据库集成 | 关联排序事务、公开/草稿隔离、引用删除保护、共享资产、批量部分成功、幂等重试 |
| 上传集成 | 假扩展名、超限流、坏图、处理失败重试、重复完成、Worker 租约过期、对象写成功而 DB 失败 |
| 安全集成 | 未登录每个写接口 401、跨源变更拒绝、到期/退出会话失效、直接预览访问拒绝、限流 |
| E2E | 登录→多图草稿→处理 ready→发布→搜索→详情复制→编辑→撤回；两种批量模式 |
| 撤回回归 | 正文、API、相关推荐、合集、站点地图、旧媒体 URL 均不泄露仅草稿引用的内容 |
| 响应式 | 390/768/1440px，无横向溢出；键盘打开/关闭大图、移动上传与复制 |

CI 使用独立 PostgreSQL 与对象存储，不访问生产。每次变更运行适用测试，合并前完整 lint/typecheck/unit/integration/build；关键流程或发布版本运行 E2E。迁移测试同时覆盖空库创建和从上一版本升级。

性能验收基线：固定环境记录 CPU/内存、数据库规模和工具版本；1 万内容、每页 24 条、20 并发访问，列表 API p95 目标 <500ms（不含图片传输）。移动端 Lighthouse LCP 目标 <2.5s、CLS <0.1；指标是验收目标，不是已测结果。超标先检查 SQL、图片字节与客户端 JS，不直接引入新服务。

## 12. 实施任务顺序

每个任务文件包含：状态 todo/doing/blocked/done、依赖、输入文档、允许修改范围、交付物、验收命令、结果与下一步。每次只推进可验证的一块，不让 AI 一次生成全部业务再统一调试。

| 任务 | 依赖 | 交付与验收 |
|---|---|---|
| T01 工程初始化 | 无 | AGENTS/README、固定依赖、配置、Compose、环境校验、CI；首页能启动，lint/typecheck/build 通过 |
| T02 数据层 | T01 | schema/migrations/seed；空库迁移、唯一/外键约束、草稿查询隔离测试 |
| T03 管理认证 | T02 | 创建/重置管理员、登录/退出、session/CSRF/限流；直接绕过 UI 调接口仍受保护 |
| T04 上传闭环 | T03 | 批次、私有存储、Worker、衍生图、进度、重试；两种模式幂等、坏图测试 |
| T05 内容后台 | T04 | 编辑、预览、排序、发布/撤回、复制、批量、分类/标签/模型；完整事务测试 |
| T06 公开画廊 | T05 | SSR 列表/详情、搜索筛选、复制、大图、返回恢复、媒体鉴权；手机与桌面 E2E |
| T07 合集与发现 | T06 | 合集管理/公开页、相关推荐、关于；撤回成员不泄露 |
| T08 SEO 与统计 | T07 | metadata/sitemap/robots/事件验证；公开索引与草稿隔离测试 |
| T09 上线准备 | T08 | Docker 生产镜像、备份恢复 runbook、性能与安全回归；完整流程验证 |

给 AI 的任务提示模板：

```text
读取 AGENTS.md、docs/prompt-gallery-prd.md、docs/technical-design.md
以及 docs/tasks/Txx-任务名.md，并检查目标目录现有代码。
只实现该任务及必要依赖，不扩展功能或升级无关依赖。
先检查接口、数据约束与安全边界，再按纵向流程实施。
运行任务验收命令，记录真实结果；失败要定位，不跳过检查。
完成后更新任务状态，列出改动、验证结果和未完成事项。
```

## 13. 部署、监控与恢复

生产由 Caddy 提供 HTTPS，转发 Web；Web 和 Worker 使用相同代码版本。数据库与 MinIO 管理端口不暴露公网；托管 S3 时移除 MinIO 服务。代理单文件请求体上限略高于 20 MiB（建议 22 MiB），应用仍按实际 20 MiB 限制。上传请求超时配置为 120 秒，图片处理在 Worker 中完成。

健康检查 /api/health/live 只表示进程活着；/api/health/ready 检查 DB 和存储可用，错误不暴露凭据。Worker 记录心跳、待处理数量、最长等待时间、失败次数；日志带 requestId/jobId，告警关注持续失败、磁盘和数据库连接耗尽。

发布流程：备份数据库 → 审查 migration → 一次性迁移任务 → 部署 Web/Worker → 健康检查 → 管理员发布/撤回冒烟。不得每个 Web 副本启动时竞争执行迁移。数据库结构采用向后兼容的 expand/contract；镜像回滚不等于数据库回滚，破坏性迁移必须单独设计恢复方案。

每天备份数据库，保留至少 7 份日备份及 4 份周备份；对象存储启用版本保护或等价独立备份。目标 RPO 24 小时、RTO 4 小时。首次上线前必须实际恢复到隔离环境并核对图片引用，不能仅以“备份命令成功”作为可恢复证明。

## 14. 官方资料与适用范围

以下官方资料于 2026-10-26 查阅，用于核对框架、认证边界、迁移与运行时政策；具体数据库结构、接口和任务划分是本项目设计。

- [Next.js 安装与项目配置](https://nextjs.org/docs/app/getting-started/installation)：初始化时复核环境与兼容依赖。
- [Next.js 认证指南](https://nextjs.org/docs/app/guides/authentication)：服务端授权必须覆盖数据访问，不能只靠页面跳转。
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)：以 schema 生成、审查并应用 SQL 迁移。
- [Node.js release policy](https://nodejs.org/en/about/previous-releases)：生产选择受支持 LTS，安装时核对具体版本状态。

正式开始 T01 时核对补丁版本和依赖兼容性；若与本文基线冲突，先记录原因及调整，不盲目复制过期命令。
