# Prompt Gallery

面向公众的图片生成 Prompt 灵感库。前台提供图片库、详情、合集；后台提供登录、批量上传、内容编辑发布、合集编辑和访问统计。界面为深色主题，视觉规范见 [PRD 第 7 节](docs/prompt-gallery-prd.md)。

## 环境

- Node.js 24.16.0
- pnpm 10.34.9

本机如果已经装了其他主版本的 pnpm，先启用项目指定的版本：

```powershell
corepack enable
corepack prepare pnpm@10.34.9 --activate
```

## 本地启动

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm check
pnpm dev
```

打开 http://localhost:3000 。

当前机器如果没有 Docker，到这里即可。Postgres 和 MinIO 要等 Docker 可用后再启动：

```powershell
docker compose --env-file .env.local up -d postgres minio minio-init
pnpm db:migrate
pnpm db:seed
```

数据库端口 `5432` 和 MinIO 端口 `9000`、`9001` 只绑定本机回环地址。容器之间使用服务名 `postgres` 和 `minio`，不要在容器里写 `localhost`。

`pnpm db:migrate` 和 `pnpm db:seed` 会读取 `.env.local`。种子只创建分类、标签、模型和未发布草稿。

### 没有 MinIO 时上传图片

上传由 Next 服务接收、独立 Worker 处理，两个进程必须读写同一份存储。没有 MinIO 时，在 `.env.local` 里改用本地文件存储，并同时启动 Worker：

```powershell
# .env.local
STORAGE_DRIVER=fs
STORAGE_FS_ROOT=.data/storage

pnpm dev
pnpm worker:dev   # 另开一个终端
```

`memory` 只适合单进程测试：文件存在进程内存里，重启或跨进程后图片会丢失。`fs` 在生产环境会被拒绝启动。

### 示例内容

服务和 Worker 都在运行时，可以用本机管理员通过真实接口生成并发布一批示例内容：

```powershell
$env:DEMO_ADMIN_PASSWORD = "<本机管理员密码>"; pnpm demo:content
```

用户名默认 `editor`，可用 `DEMO_ADMIN_USERNAME` 覆盖。脚本只允许指向 `localhost` / `127.0.0.1`。

### E2E

`pnpm test:e2e` 默认复用 `http://localhost:3000` 上的开发服务器（可用 `E2E_BASE_URL` 覆盖；后台接口校验 Origin，必须与 `APP_URL` 一致，不要用 `127.0.0.1`）。后台发布流程、“加载更多后返回”和夹具准备需要本机管理员和正在运行的 Worker：

```powershell
$env:E2E_ADMIN_USERNAME = "editor"; $env:E2E_ADMIN_PASSWORD = "<本机管理员密码>"; pnpm test:e2e
```

不设置这两个变量时，依赖管理员的用例会跳过。首次运行前执行 `pnpm exec playwright install chromium`。

## 脚本

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm worker:dev` | 用 tsx 监视图片处理 Worker |
| `pnpm build` | 构建 Next.js standalone，并用 tsup 构建 Worker |
| `pnpm start` | 复制静态资源后启动 standalone 服务 |
| `pnpm worker:start` | 运行 `dist/worker/index.js` |
| `pnpm lint` | `eslint .` |
| `pnpm typecheck` | 生成 Next 路由类型后执行 `tsc --noEmit` |
| `pnpm test` | 运行 Vitest 单元测试 |
| `pnpm test:integration` | 在独立测试库上运行迁移、约束、认证、上传和公开隔离测试 |
| `pnpm test:e2e` | 用 Playwright 打开本机开发服务器 |
| `pnpm db:generate` | 根据 schema 生成迁移 |
| `pnpm db:migrate` | 应用迁移 |
| `pnpm db:seed` | 幂等写入开发种子 |
| `pnpm admin:create` | 交互式创建唯一管理员 |
| `pnpm admin:reset` | 交互式重置管理员密码并清除会话 |
| `pnpm demo:content` | 通过本机接口生成并发布示例内容 |
| `pnpm check` | lint、typecheck、test、build |

`pnpm test:integration` 会删除并重建 `DATABASE_URL` 对应的 `*_test` 库，不会动开发库。创建管理员使用 `pnpm admin:create`，密码只在终端里隐藏输入。
