# 备份与恢复

目标是数据库最多丢失 24 小时内的变更，并在 4 小时内恢复到可登录、可发布的状态。对象存储使用版本保护或一份独立备份。下面的步骤要在隔离环境里实际做一次，不能只看备份命令是否成功。

## 每天备份

在数据库主机上执行，保留至少 7 份日备份和 4 份周备份：

```bash
pg_dump --format=custom --no-owner --file "prompt-gallery-$(date -u +%F).dump" "$DATABASE_URL"
```

把 dump 复制到与生产机器分开的存储。对象存储打开版本控制，或按同样周期复制桶。不要把数据库端口和管理控制台暴露到公网。

## 恢复到隔离环境

1. 准备一台空的 PostgreSQL 17 和空的私有对象存储，使用新的口令。
2. 先恢复数据库，再核对图片对象是否还在。
3. 用与备份相同版本的应用镜像启动一个 Web 和一个 Worker。迁移只作为一次性任务运行，不要让每个 Web 进程启动时抢着迁移。
4. 用管理员账号打开发布内容和一条草稿，确认公开页面、搜索和媒体地址只返回仍处于发布状态的内容。

```bash
createdb prompt_gallery_restore
pg_restore --no-owner --dbname "$RESTORE_DATABASE_URL" prompt-gallery-YYYY-MM-DD.dump
```

镜像回滚不会回滚已经执行的数据库迁移。破坏性迁移需要单独的恢复方案，不能靠重新部署旧镜像。

## 发布顺序

1. 备份数据库。
2. 审查新的 migration。
3. 在维护窗口运行一次 `pnpm db:migrate`。
4. 部署相同版本的 Web 和 Worker。
5. 请求 `/api/health/live` 和 `/api/health/ready`。
6. 管理员发布一条内容，再撤回，确认公开页面立即消失。

`/api/health/live` 只说明进程还在。`/api/health/ready` 会检查数据库和对象存储，失败时不返回口令或连接串。
