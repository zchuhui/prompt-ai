# T08 SEO 与统计

- 状态：done
- 依赖：T07
- 输入文档：`docs/technical-design.md` 第 9 节
- 允许修改范围：metadata、sitemap、robots、事件接口。
- 交付物：`src/app/sitemap.ts`、`src/app/robots.ts`、`POST /api/v1/events`

## 验收命令与结果

开发服务器返回：

- `GET /robots.txt` 允许 `/`，禁止 `/admin` 和 `/api/`，并指向站点地图。
- 带 `q` 的首页 HTML 含 `noindex`。
- 内容撤回后，`GET /sitemap.xml` 不再包含 `/prompts/`，仍包含 `/about`。
- `POST /api/v1/events` 对公开内容返回 202。

集成测试确认统计行不包含原始 IP，撤回后的 `promptId` 返回 404，同一 IP 窗口达到 60 次后返回 429。详情页输出 CreativeWork / ImageObject JSON-LD，只使用标题、简介、正文、实际图片和已有来源作者。

## 事件

只接受 `page_view`、`detail_view`、`prompt_copy`、`search`、`search_empty`。请求体上限 2 KB。管理页不挂公开统计组件。

## 已知限制

没有在浏览器里核对复制成功后的事件，因为这个浏览器不能写剪贴板。复制失败时不会发送 `prompt_copy`。

## 下一步

T09 上线准备。
