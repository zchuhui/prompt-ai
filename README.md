# Prompt Gallery

面向公众的图片生成 Prompt 灵感库。当前仓库完成了工程初始化：首页可以启动，数据表、登录和上传尚未实现。

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
```

数据库端口 `5432` 和 MinIO 端口 `9000`、`9001` 只绑定本机回环地址。容器之间使用服务名 `postgres` 和 `minio`，不要在容器里写 `localhost`。

## 脚本

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建 Next.js，并产出 standalone |
| `pnpm start` | 复制静态资源后启动 standalone 服务 |
| `pnpm lint` | `eslint .` |
| `pnpm typecheck` | 生成 Next 路由类型后执行 `tsc --noEmit` |
| `pnpm test` | 运行 Vitest |
| `pnpm check` | lint、typecheck、test、build |

`db:*`、`worker:*` 和 `admin:*` 会在后续任务里加入。
