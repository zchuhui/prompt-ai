# Prompt Gallery

面向公众的图片生成 Prompt 灵感库。当前仓库完成了工程初始化和数据层：首页可以启动，数据库可以迁移并写入开发种子。登录和上传尚未实现。

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
| `pnpm check` | lint、typecheck、test、build |

`pnpm test:integration` 会删除并重建 `DATABASE_URL` 对应的 `*_test` 库，不会动开发库。创建管理员使用 `pnpm admin:create`，密码只在终端里隐藏输入。
