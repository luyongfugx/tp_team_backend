# TeamSpace 照片工作区第一版

本地实施日期：2026-09-14。对应《2026-09-14-teamspace-timemark-comparison.md》第 6 节首个可评审版本。只运行在本机，未发布到线上。

## 可以直接体验

- 本地入口：http://127.0.0.1:3000/
- 演示图库：http://127.0.0.1:3000/workspace/local-workspace-demo/photos
- 演示项目：http://127.0.0.1:3000/workspace/local-workspace-demo/projects
- 演示账号：`local-test@example.com`，开发环境验证码 `888888`。该验证码能力是仓库原有功能；本次没有新增生产登录绕过。
- 演示团队名称：**城建现场 · 本地演示**。4 个项目、3 位成员、67 个测试照片记录。图片为标注 LOCAL DEMO 的插图，不是真实拍摄或验真证据。

## 产品能力更正

用户已确认目前没有照片验真功能。已移除新工作区及旧管理界面的验真入口，移除首页相关宣传，并将详情说明改为仅展示保存的拍摄信息。先前将旧代码视为可用产品能力的判断不成立。后端历史实现未在本次纠正中删除。

## 本版交付

1. 登录后进入照片工作区，记住上次团队；独立的照片、项目、成员、导出入口。团队和账号设置、平台管理保留原有界面。
2. 项目和成员卡片采用最近照片拼贴，显示数量和更新时间；整张卡片进入对应图库。项目卡片支持名称/地址搜索、最近更新/名称/数量排序。
3. 项目内采用紧凑标题，直接展示照片；管理者可新建、编辑项目名称与地址。新项目加入现有团队成员，与原 App API 行为一致。
4. 所有照片、项目照片、成员照片共用关键词、成员、项目、日期和媒体类型筛选；网格/列表模式共用数据；照片每页最多 48 条，在数据库分页并用时间、ID 稳定排序。
5. 进入选择模式为 0 张，可逐张、选本页当天、选本页、选全部筛选结果、排除个别照片。同一筛选范围换页保留选择，改变筛选或团队时清空选择。
6. 大图支持左右键、Esc、1–4 倍缩放、拖动、双击缩放、适应窗口；可收起详情和缩略图导航。关闭后恢复原焦点与图库位置。视频使用播放器；无法预览的文件给出下载提示。
7. 详情包括作者、时间、项目、位置、GPS、设备、系统、时区、照片码；可复制位置/照片码、打开外部地图；已移除通往旧验真页面的跳转。未嵌入第三方地图瓦片。当前没有照片验真功能，不提供验真入口或状态。
8. ZIP 为数据库持久任务，独立进程执行；按日期/项目/拍摄人分文件夹；任务显示排队、进度、完成、部分失败、失败、取消、过期。完成文件保留 7 天，失败项可见，部分失败重试仅重新处理失败文件。
9. 新的查询、单张下载、导出创建、执行和文件下载共用权限：团队所有者/管理员/已有平台超级管理员可看团队；普通成员仅看自己的照片；已删除团队、项目、照片不返回。用户只能查看和操作自己创建的导出任务。
10. 首版新界面文案覆盖简体中文、繁体中文、英文；其他已有账号语言进入新版时使用英文，旧页面仍保留原多语言库。文案集中在 `lib/workspace/i18n.ts`，未宣称完成所有语言翻译。

## 文件结构

- `components/workspace/workspace.tsx`：工作区导航、URL 状态、筛选、图库、卡片及任务界面。
- `components/workspace/photo-preview.tsx`、`dialog.tsx`：照片查看器、对话框焦点管理。
- `components/workspace/workspace.css`：仅工作区使用的布局与响应式样式。
- `lib/workspace/model.ts`：共享筛选、日期、选择协议与类型。
- `lib/workspace/server.ts`：权限、Prisma 查询、返回字段映射。
- `lib/workspace/files.ts`：存储来源校验、文件流、目录及文件名规则。
- `lib/workspace/exports.ts`：任务授权和排队；按用户加数据库锁，防止并发创建突破 3 个进行中任务的上限。
- `app/api/workspace/**`：工作区 API。现有 App 协议保持兼容。
- `scripts/workspace-export-worker.ts`：持久导出任务执行器。
- `prisma/migrations/20260914090000_workspace_exports`：新增独立任务表，避免改变原 App 打包模型。

当前另一个本地服务也监听了 3000 端口的 IPv6 地址；为避免 `localhost` 解析到其他项目，当前预览使用明确的 IPv4 地址 `127.0.0.1:3000`。

## 本机服务

本机 Next.js、MySQL、导出执行器都已启动为当前登录会话的 launchctl 服务。终端退出后仍会运行；这些 plist 保存在项目 `.local/`，没有安装为开机登录项。

```sh
# 状态
launchctl print gui/$(id -u)/local.tp-team-backend
launchctl print gui/$(id -u)/local.tp-team-backend.mysql
launchctl print gui/$(id -u)/local.tp-team-backend.exports

# 重启网页与执行器
launchctl kickstart -k gui/$(id -u)/local.tp-team-backend
launchctl kickstart -k gui/$(id -u)/local.tp-team-backend.exports

# 新登录会话中加载服务（仅未加载时）
launchctl bootstrap gui/$(id -u) .local/local.tp-team-backend.mysql.plist
launchctl bootstrap gui/$(id -u) .local/local.tp-team-backend.plist
launchctl bootstrap gui/$(id -u) .local/local.tp-team-backend.exports.plist
```

日志位于 `.local/server.log`、`.local/server-error.log`、`.local/export-worker.log`、`.local/export-worker-error.log`。导出产物默认位于 `.data/workspace-exports/`，已加入忽略规则。SQL 查询参数日志改为显式 `PRISMA_QUERY_LOG=1` 才输出，避免后台轮询日志膨胀以及默认记录会话参数。

## 后续部署需要的配置

后续 ZIP 兼容修复默认使用直接下载，普通 ZIP 不需要迁移数据库或启动 worker。仅在启用后台导出时，需要迁移数据库、启动独立 worker，并提供私有持久磁盘；确认就绪后设置 `WORKSPACE_BACKGROUND_EXPORTS=1`。详见 `2026-09-14-zip-export-fix.md`。后台导出部署步骤：

```sh
npm ci
npm run db:migrate:deploy
npm run build
npm start
# 另一个受进程管理器管理的长期进程，使用相同数据库和存储目录
NODE_ENV=production npm run worker:exports
```

`worker:exports` 在存在 `.env` 时加载它，也支持没有 `.env`、直接注入环境变量的部署。部署前风险和配置以 `2026-09-14-predeploy-review.md` 为准。

| 配置 | 作用 |
| --- | --- |
| `DATABASE_URL` | 网页和 worker 使用相同数据库 |
| `WORKSPACE_EXPORT_DIR` | 绝对路径的私有持久目录；默认为 `.data/workspace-exports` |
| `COS_PUBLIC_BASE_URL` | 现有照片对象 URL 基址；其中的主机自动允许用于文件下载 |
| `WORKSPACE_MEDIA_HOSTS` | 其他允许下载的存储主机，以逗号分隔，只填完整 hostname。仅允许 HTTPS；重定向目的主机也必须被允许 |

不要把导出目录放进 `public/`。多实例网页和 worker 必须访问同一持久共享目录；当前实现不适合无持久磁盘的纯 Serverless 实例。没有配置真实存储来源时，导出明确报告“下载来源尚未配置”；本地测试插图只在非生产环境下允许读取。

执行器每次抓取一个文件到临时磁盘，ZIP 流式写入磁盘，不在服务器内存中积累整包。每文件最多 250 MB，每任务最多 2,000 文件、合计 2 GB。Chromium 支持直接流式保存到用户选定文件，其他浏览器退回 Blob 下载；大包在这些浏览器中仍可能受到浏览器内存限制。

任务通过随机租约标识防止重复执行。执行器中断后，过期租约可重新领取；连续中断达到上限时显示失败。取消会失效租约并触发执行器中止；写入结果前再次校验租约。下载时重新校验所有照片的当前访问权限，权限或删除状态变化会拒绝下载旧包。清理器每小时清理过期产物，下载接口立即按过期时间阻止访问。

## 验证结果

- `npm run build`：通过。
- `node --test scripts/auth.test.cjs`：已有登录回归 5 项通过。
- `npm run test:workspace`：选择、跨页、全选排除、时区和夏令时、无效参数、成员权限约束、文件来源限制，5 项通过。
- `node --env-file=.env --import tsx scripts/workspace.integration.ts`：本地 API 与独立 worker 的完整链路通过。覆盖 48/19 分页、成员越权读取/下载、项目写入权限、导出所有权、排除选择、过期租约恢复、取消、部分失败、仅失败项重试、删除后拒绝旧包下载、过期下载。
- 实际解压核对：22 个照片文件 + `manifest.json`，CRC 校验通过，名称唯一，日期目录与指定时区一致，总数/成功数/失败数正确。
- 浏览器：Chrome 桌面 1512×827、内置浏览器窄屏 554×710；实测项目→图库、今天筛选、列表切换、跨页选择 2 张→后台 ZIP 完成；大图方向键切换、缩放恢复、Esc 关闭与原焦点恢复。
- 截图：`.local/screenshots/workspace-projects.png`、`workspace-preview.png`、`workspace-photos.png`。
- `npx tsc --noEmit`：新增工作区代码无类型错误；仓库原有 21 条类型错误仍在既有 App JSON 输入与验真记录组件中。与改动前日志对比一致。仓库原来配置 `ignoreBuildErrors: true`，所以不把构建成功表述为全仓库类型检查通过。

## 本版边界与下一轮

- PDF 报告、Excel 文件、集合分享、地图聚合、表单文档等仍按前述阶段 C/D 推进；没有放置虚假的可点击入口。
- 项目成员范围沿用现有团队角色和加入规则，还没有新增指定项目成员权限编辑器；普通成员默认仅看本人照片是本版保守策略。
- 原来的公开图库 `/web/team|project|user/.../photos` 和 `/api/web/photos/download` 仍是兼容接口，新工作区不依赖它们。前次调研指出的公开图库访问边界需要与 App 的对外分享需求一起处理；本次没有把旧入口的安全问题宣称为已修复。
- 原有 App `/api/photo/package` 与集合分享 API 仍独立于新的 web 工作流，没有将旧的未完成任务当成新导出任务。
- 项目/成员元数据当前一次加载；照片结果已真正分页。若实际团队拥有数千项目/成员，下一步应给卡片列表和筛选选项补服务端分页搜索。
- 演示插图不代表真实 COS 文件、视频格式或大规模导出性能已通过生产验证。正式发布前应使用真实存储配置验证实际图片/视频样本和运维容量。
