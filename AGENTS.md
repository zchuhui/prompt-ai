<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 图种

面向公众的图片生成 Prompt 灵感库。本文件是编码入口，不是产品长文。

## 工具

- 包管理器：pnpm 10.34.9（`packageManager`）。不要改用 pnpm 11、pnpm 12，也不要无锁安装。
- Node.js：24.16.0，见 `.node-version`。
- 开发：`pnpm dev`。检查：`pnpm check`（lint、typecheck、test、build）。
- 集成测试：`pnpm test:integration`。需要 PostgreSQL，会删除并重建名称以 `_test` 结尾的测试库。
- 环境：复制 `.env.example` 为 `.env.local`。不要把密钥写入仓库。

## 依赖方向

`app` → `features` → `server` / `shared`。客户端不能导入数据库、存储、认证或服务端环境变量。服务端模块显式 `import "server-only"`。

## 权限与数据

管理接口和变更操作必须在服务端校验管理员会话。页面跳转不能代替鉴权。数据库变更只追加新的 migration，不修改已经应用的历史文件。

## 文档

- 产品：[docs/prompt-gallery-prd.md](docs/prompt-gallery-prd.md)
- 技术设计：[docs/technical-design.md](docs/technical-design.md)
- 任务记录：`docs/tasks/`

## 完成标准

改动范围与当前任务一致。运行该任务的验收命令，并在任务文件里记录真实结果。未完成项留在任务文件中。
