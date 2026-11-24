# TP 总览的验真任务日报

`GET /api/admin/photo-verifications/summary?date=YYYY-MM-DD`

沿用现有 Bearer 会话与总管理员权限（未登录 401、非管理员 403）。只读聚合，无数据库迁移、不返回照片码、用户身份或原始照片。

日期按北京时间 `Asia/Shanghai` 的任务 **createdAt** 统计，起点包含、终点不包含。响应包含所选自然日与前七天同日；不接受未来日期或无效日期。两组汇总在同一个数据库读取事务内完成。客户端无需翻页下载所有任务。

- `total`：该日提交的全部任务。
- `success`：`SUCCEEDED && verified=true`。
- `failure`：`FAILED` 或 `SUCCEEDED && verified=false`。
- `processing`：`PENDING`、`PROCESSING`。
- `unknown`：其他结果，包含成功处理但 `verified` 尚未确定的记录，不归入失败。
- `scope=all_channels`：包含 App/H5 等全部渠道，不能把 H5 报告页面浏览量当成验真任务数。

所有状态数量之和等于 total。真实空日返回 0；读取失败返回错误，不伪造零值。返回 `Cache-Control: private, no-store`，客户端可保留带读取时间的离线缓存。

测试：`node --import tsx --test scripts/photo-verification-summary.test.ts scripts/verification-analytics.test.ts`。
