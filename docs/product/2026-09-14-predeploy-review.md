# TeamSpace 部署前代码审查

日期：2026-09-14。范围：当前工作区相对 HEAD 的网页改造、公开图库、工作区 API、导出 worker、依赖和数据库迁移。尚未提交、推送或部署到远端。

## 结论

修复下列新增问题后，可提交并进入受限测试环境验证。此结论不等于已完成线上真实存储、手机扫码、多实例容量或全仓库安全验收，不建议直接据此全量上线。

## 本轮发现并修复

| 级别 | 问题与影响 | 修复 |
| --- | --- | --- |
| 高 | 公开列表 API 缺少 scope 时会变成无集合范围查询；scope.id 接受对象可能被当作 Prisma 过滤表达式 | 列表、筛选选项、单日选择、预览定位、打印选择和导出均严格验证范围；仅允许非空字符串 ID，非法请求返回 400。单张下载保留原有按 photoID 访问协议 |
| 中 | 请求体仅在完整读取后检查大小，无法限制大请求的内存占用 | 两个公开 POST 接口按流读取，超过 300,000 字节立即停止，即使没有 Content-Length 也会拒绝 |
| 中 | worker 下载失败或单文件超限时，残留临时文件未及时删除，可能绕过成功文件累计上限占满磁盘 | 每个失败文件立即清理；任务收尾仍清理工作目录 |
| 中 | 已选照片被删除、范围内记录变化时，全选导出可能静默少导出 | 网页传 expectedCount，服务端重新核对实际数量，不一致拒绝；旧的显式 ids 请求保持兼容 |
| 中 | 打印的首次请求没有纳入取消控制；快速选择不同日期时旧请求可能覆盖新选择 | 打印请求从开始即绑定 AbortController；按日期分别追踪请求，清空、全选或手动调整选择会使过期请求失效 |
| 中 | 构建追踪动态文件路径时误扫项目目录，出现 NFT 警告 | 演示文件限定固定目录，运行时私有导出目录不进入部署文件追踪 |
| 低 | worker 启动脚本强制要求 .env，环境变量注入式部署会启动失败 | 使用 Node 24 的 --env-file-if-exists；保留环境变量注入方式 |
| 低 | 本地目录仅在本机 Git exclude 中忽略 | .gitignore 增加 .local/，避免其他检出环境误提交日志、本地数据库或截图 |

## 兼容性范围

- 登录、验证码、二维码、Token、客户端登录会话代码未改；登录后改为进入新工作区。
- 原 App `/api/photo/list/v1`、`/api/photo/search`、`/api/photo/package` 和用户/团队接口未改。
- 现有依赖包的锁定版本没有升级；新增 archiver、ExcelJS、Leaflet、tsx 及类型依赖。
- 共享 Prisma 修改仅为 SQL 参数日志默认关闭；需要时显式 PRISMA_QUERY_LOG=1。
- 数据库只新增 WorkspaceExport 表，不修改 User、Session、二维码表和原 App 打包表。
- **原 `/api/web/photos/download` 有修改**：现在排除已删除的团队、项目、用户，且下载来源只允许配置过的 HTTPS 存储域名。旧请求 photoID 参数仍可用；自定义 CDN 未加入允许列表或旧 HTTP 来源可能下载失败，错误文案也变成错误码。不能声称所有既有接口都完全未变。
- 公开分享仍沿用既有“持有团队/项目/个人链接即可访问”的模型，未新增签名 shareKey、密码或到期机制。此次收紧 scope 不会把已有公开链接变成登录私有链接。

## 验证证据

本地 MySQL 隔离测试库 tp_team_backend_local，网页使用 Node 24、Next 开发服务；另以 `next start` 在 127.0.0.1:3101 验证生产构建。所有本地测试临时登录会话、验证码及 QR 记录均清理，未发送邮件或调用第三方登录。

- 单元测试：auth、workspace、share-gallery 共 15 项；包括无效/缺失/对象 scope、无 Content-Length 超大请求、时区边界和选择状态。
- 公开图库集成：所有列表模式对非法 scope 返回 400；三种正常分享页、ZIP、XLSX 内容、时区、单张下载、跨项目拒绝、过大选择、预期数量不符均通过。
- 工作区与 worker 集成：48/19 分页、成员和写入权限、任务所有权、22 文件 ZIP、过期租约恢复、取消、部分失败、仅失败项重试、权限变化、过期下载均通过。
- 一万记录回归：上传快照稳定，深链接定位第 209 页，全选 5,000 排除 1 张导出 4,999 行；首屏只包含 48 张数据。
- 登录接口回归：生产模式下真实数据库验证码被消费，网页/App 登录、创建 QR、等待/确认/换取凭证、重复轮询、原 App 照片 API、无效 browserSecret、未登录确认、退出后失效均通过。该测试模拟手机确认接口调用，未覆盖实体手机摄像头扫码和跨域真实环境。
- Chrome：跨页勾选、导出范围显示 2 张、实际 Excel 下载成功；按日选择、项目和日期筛选的复查见本轮执行记录。
- `npm run build` 通过；修复后不再出现 NFT 文件追踪警告。
- `tsc --noEmit` 仍有 21 条历史错误，位于原 App JSON 输入及旧验真记录组件；本轮修改文件无新增类型错误。现有 Next 配置 `ignoreBuildErrors: true` 未改。

可重复执行（先用本地种子准备演示库，禁止对生产运行这些 fixture 脚本）：

```sh
node --import tsx --test scripts/auth.test.cjs scripts/workspace.test.ts scripts/share-gallery.test.ts
node --env-file=.env --import tsx scripts/share-gallery.integration.ts
node --env-file=.env --import tsx scripts/workspace.integration.ts
node --env-file=.env --import tsx scripts/share-gallery.selection-regression.ts
LOCAL_TEST_BASE_URL=http://127.0.0.1:3101 node --env-file=.env --import tsx scripts/auth.integration.ts
```

原始日志在被忽略的 `.local/review-*.log`；依赖扫描为 `.local/review-audit.json` 和 `.local/review-audit-baseline.json`。本地演示图片不是生产 COS/视频样本。

## 尚未清零的风险

1. **依赖安全告警**：`npm audit --omit=dev` 当前共 28 项（4 critical、12 high、11 moderate、1 low）；相同命令对 HEAD 锁文件为 27 项（中危少 1）。原有 Next、COS SDK 等告警没有通过本次界面改造解决；未执行会跨主版本改动协议依赖的 `npm audit fix --force`。上线前需单独评估暴露路径并处理框架/存储依赖升级。
2. **新增 ExcelJS 告警**：通过 uuid 传递引入，涉及 uuid 的 v3/v5/v6 输出缓冲区边界检查。安装的 ExcelJS 代码只调用 v4，此导出路径没有传入输出缓冲区、也不解析上传 Excel；没有确认在当前路径可触发，但扫描仍非零。参考 [uuid 公告](https://github.com/advisories/GHSA-w5hq-g745-h8pq)。
3. **公开链接访问边界**：需要团队/产品接受现有公开分享模型；如果需要撤销、到期或防止项目数字 ID 枚举，应作为独立访问协议改造，兼顾 App 已发出的旧链接。
4. **真实媒体和容量**：自定义 CDN/私有对象/过期签名/网络速度需在测试服务器验证。同步公开 ZIP 每请求最多 200 文件、源数据 100 MiB，每进程最多 2 个；仍使用内存组包，需观察 RSS 和并发下的可用内存。网关还应配置请求速率和超时。
5. **后台导出部署**：worker 未启动时任务会一直排队；多实例若磁盘不共享，会出现导出完成但其他网页实例下载不到文件。每后台任务最多 2 GiB 源文件，临时文件与 ZIP 并存时可能需要约 4 GiB 以上磁盘；成品保存 7 天，需要容量监控。
6. **大团队元数据**：照片分页和一万记录已验证；项目/成员选项及工作区卡片元数据仍整批读取，旧项目封面会补查询。数千项目/成员或十万以上照片需要基于真实查询计划继续压测，不能从本地一万记录推断无限规模表现。
7. **浏览器和语言**：新增交互文案主要为简体、繁体、英语，其余语言回退英语；打印/PDF 仍依赖浏览器原生打印，最终纸张布局与真实视频兼容性需要人工验收。

## 测试环境部署顺序

使用 Node 24，在完整项目目录执行。复用现有登录/二维码配置，不重新生成会话密钥，不清空 User/Session 表。

```sh
npm ci
npm run db:migrate:deploy
npm run db:migrate:status
npm run build
npm start
```

另由进程管理器启动并守护：

```sh
NODE_ENV=production npm run worker:exports
```

网页和 worker 必须使用相同 DATABASE_URL、相同绝对路径 WORKSPACE_EXPORT_DIR 和同一份存储配置。多实例使用共享持久目录；目录不放 public 下。将 worker 所需 scripts、lib、app/api/_utils、tsconfig.json 和生产依赖随完整项目部署，不能只复制前端静态资源或假设 Next standalone 自动包含独立 worker。

- `WORKSPACE_MEDIA_HOSTS`：添加实际 CDN hostname，逗号分隔；仅允许 HTTPS，重定向的目的域名也要允许。
- `COS_PUBLIC_BASE_URL` 和已有 `TENCENT_COS_BUCKETS_JSON` 中允许读取的 team/ios_app/android_app 桶主机自动加入来源列表。
- `.env.example` 已补新增配置说明。不要上传 `.env`、`.local`、`.data`、public/workspace-demo 演示图片或执行本地 seed 到线上。
- 网关同时路由页面和 `/api/web/photos/*`、`/api/workspace/*` 到此 Next 服务，不能将这些新路径转发到其他旧服务。

测试服务器先验收：原验证码与手机扫码登录 → 团队/项目/个人实际分享链接 → 组合筛选及跨页勾选 → 真实照片/视频预览与单张下载 → ZIP、Excel、打印 → 工作区后台导出 → 重启 worker 后任务恢复。确认图片域名、权限、内存和磁盘表现后，再考虑扩大范围。

回退时回到旧应用版本，并停止新 worker。新增 WorkspaceExport 表可暂留，不需要为回退删除旧用户、会话或照片数据；导出文件仍由私有磁盘策略管理。
