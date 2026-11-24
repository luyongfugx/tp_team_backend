# 验真网页每日访问统计

## 实现与统计口径

GA4 属性沿用 `547150932`（team-web-4f79d），新建专用 Web 数据流 `timeprint-h5-verification`。
生产专用 Measurement ID：`G-LJ416MXPGD`；streamId：`16404160241`。

普通页面继续使用现有 Firebase Analytics；不修改旧流 `G-Z9HJ16FDTS` / `15325751892` 的增强衡量配置。
代码明确拒绝复用旧流，默认关闭，配置不存在或无效时不加载 Google tag。

| 入口 | 类别 | 固定标题 |
| --- | --- | --- |
| `/r/{photoCode}` | share_record | Timeprint Shared Photo Record |
| `/record/{photoCode}` | photo_record | Timeprint Photo Record |
| `/verify/{taskID}` | verification_report | Timeprint Verification Report |

每类的虚拟地址为 `https://h5.timeprint.net/_analytics/{类别}/{browser或embedded}`。
仅 `embed=1` 归为 embedded，其余为 browser；browser 不代表已确认的分享接收者或某个 App/渠道。
`/r` 是 rewrite，按浏览器入口分类；`/s` 只重定向，最终显示 record 或 verify 时才计数。
样例、preview、API 请求、服务端渲染、Link 预取不计浏览；错误或未找到页面仍计一次。

三类都只手动发送标准 `page_view`，固定 title/location，清空 referrer。
安全上下文在加载 SDK 前写入全局和 config，并在导航时更新，覆盖自动事件。
真实路径仅用于文档内短期比较；不把照片码、任务 ID、query、fragment、上一页、账号信息放入上报对象。
同页重渲染、主题/语言/query/hash 变化不增 PV；换照片、返回、刷新增加 PV。
SDK 被拦截、配置接口异常不会影响业务查询或展示。未新增强制同意命令，沿用已有 Google consent 队列和 `ga-disable-<ID>` 选择。

`app/(site)` 和 `app/(verification)` 是两个根布局，共用同一页面外壳和字体。
路由分组不改变外部 URL；跨组的 Next 导航会加载新文档，销毁原统计监听器。
不能再在 `app/layout.tsx` 增加共享根布局，否则该隔离会失效。
验真根布局统一设置 no-referrer，包含样例和重定向页。
`app/web` 的数据辅助模块保留原位置，API 路由不移动。

## 启用与回滚

在同一个 GA4 属性中创建专用 Web 数据流，记录实际 Measurement ID 和 streamId。
关闭新流的增强衡量总开关，并检查所有子项（尤其 History 页面浏览）均关闭；不要改旧流。
在生产环境进行网络验收，确认没有额外连接目标、原始 URL 或自动重复 page_view。

服务端环境变量（不是 NEXT_PUBLIC，无构建期硬编码）：

```dotenv
VERIFICATION_ANALYTICS_ENABLED=1
VERIFICATION_ANALYTICS_MEASUREMENT_ID=G-LJ416MXPGD
VERIFICATION_ANALYTICS_STREAM_ID=16404160241
VERIFICATION_ANALYTICS_ENHANCED_MEASUREMENT_DISABLED=1
```

最后一项是运维核验确认，不会自动修改 GA。不得在未关闭增强衡量时填写 1。
`GET /api/config/verification-analytics` 返回公开 ID 和 enabled，响应 no-store。
仅生产构建且浏览器 origin 精确为 `https://h5.timeprint.net` 时启动采集，本地和预发布域名不采集。

修改环境变量后按部署平台重启/重新部署进程。新打开页面和后续导航会读取新配置；
不能声称配置台一改所有已打开标签页立即停发。已加载 SDK 的标签页在收到关闭配置后设置
Google opt-out，后续恢复采集需刷新页面；已打开但未导航的页面需刷新/关闭才能停止旧文档自动事件。
回滚将 ENABLED 设为 0 后重启服务；不删除 GA 历史数据、不改变旧流，不需要数据库迁移或移动端发版。

## 可复用按日查询

先确认最终专用 streamId。只预览请求，不使用凭据或访问 GA：

```bash
npm run analytics:verification:report -- --start 2026-11-24 --end 2026-11-25 --stream-id 16404160241 --dry-run
```

已有授权 OAuth 客户端通过环境变量 `GA_ACCESS_TOKEN` 安全注入只读 access token；
不要把 token 写入命令行参数、仓库、报表或聊天。执行：

```bash
npm run analytics:verification:report -- --start 2026-11-24 --end 2026-11-25 --stream-id 16404160241 --coverage /绝对路径/coverage.json --out /绝对路径/report.json
```

coverage 文件不含凭据，格式如下。collectionStartedAt 只填写真正上线且采集验收通过的时刻；
verifiedDateRanges 只能填写确认采集持续有效的完整自然日，发生停采的日期不要包含在内。

```json
{
  "streamId": "16404160241",
  "collectionStartedAt": null,
  "verifiedDateRanges": []
}
```

脚本输出日期、三类各自 UV/PV、独立查询的三类去重总 UV/PV、采集状态、六路径明细、
browser/embedded 各自的全量去重数、跨日期去重总数，以及每页请求时间、rowCount、时区和响应元数据。
所有请求过滤 streamId、hostName、eventName=page_view 和虚拟路径白名单。
`totalUsers` 是 GA 观测的去重用户，不是精确自然人数；`screenPageViews` 为 PV。
不要相加页面、打开方式或日期的 UV。

分页不完整、rowCount 不一致、权限错误或失败都保留为未知；不把空数据补零。
上线前标记未采集，上线当天标记非完整日，当天标记未结束；
只有已核验完整日期且成功无阈值、抽样、数据丢失、时区异常的完整 API 查询才可填 0。
GA 处理可能延迟，允许重复查询。历史 2026-11-17 至 2026-11-23 不可据空行判断无人访问。

## 验证

```bash
npm run test:verification-analytics
npm run build
npm run start -- --hostname 127.0.0.1 --port 3317
# 另一终端；默认使用本机 Chrome 的独立测试配置，不使用用户登录会话。
npm run test:verification-analytics:browser
```

浏览器测试从 Google 下载官方 gtag.js，使用未注册测试 ID；所有 collect 请求在本机截断。
把测试域名请求映射到本地生产构建，不把开发访问写入正式 GA。
可用 `PLAYWRIGHT_CHANNEL=chromium` 切换已安装的 Playwright Chromium，
`ANALYTICS_TEST_BASE_URL` 指定本地测试端口。不要把该地址指向生产环境。
测试覆盖自动首访/session 标记、自动 engagement 时间参数、无页面字段的 SDK 事件继承安全上下文、三类页面和 embed、不同照片、主题语言、
刷新返回、跨根布局、旧 History 监听器隔离、旧分享重定向、缺失配置/拦截/opt-out、预取和 SSR。
为避免 Playwright 不拦截 HTTP 重定向后续请求而访问真实域名，测试把本地 307 转成等效的 meta 导航。

本地网络验收只证明请求内容；不是“GA 已收到”的证据。
上线后另用只读 GA Data API `runRealtimeReport` 核对专用 streamId、eventName=page_view、
unifiedScreenName=上表固定标题和 eventCount。实时 activeUsers 不能替代按日 totalUsers。
可复用请求体见 [verification-analytics-realtime.json](verification-analytics-realtime.json)，填写实际 streamId。
记录冒烟时间和访问次数，说明首日含验收访问；不能假设 debug_mode 自动排除。
按日数据未就绪时明确标记待处理。首个完整日为验收通过后的下一个北京时间自然日。

## 技术依据

- [Google 手动页面浏览与去重](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Google tag 的页面上下文设置](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [Next.js 多根布局导航](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
- [GA Data API 维度与指标](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
- [Realtime API 维度与指标](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema)
