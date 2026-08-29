# 照片验真后端部署

本文说明 `team_backend` 如何部署照片 JSON 上传授权、验真图片上传授权和验真任务编排。

## 1. 数据库

部署版本前执行：

```bash
npx prisma generate
npx prisma migrate deploy
```

迁移会创建 `PhotoVerificationTask`，并通过后续迁移增加 `verificationProgress` JSON 字段。每张照片对应一条任务，保存提交用户 `userID`、图片 URL/对象键、任务状态、识别照片码、验真结果、错误信息和阶段进度。

阶段固定按 `PHOTO_CODE → TIME → ADDRESS → PHOTO_INFO` 执行。每个阶段状态为 `PENDING`、`RUNNING`、`COMPLETED` 或 `FAILED`。任务查询接口通过 `progress.currentStage` 和 `progress.stages[]` 返回最新快照，供 iOS/Android 轮询刷新进度页。

## 2. COS 桶

需要创建并建议保持为私有读的两个桶：

- `photocode-json-1330977225`：客户端写入 `<14位照片码>.json`；OCR 服务读取源 JSON，并写入 `<14位照片码>_verified.json`。
- `photocode-verify-images-1330977225`：登录用户写入 `verify/<userID>/<UUID>.jpg`；OCR 服务读取待验真图片。

后端用于签发 STS 的 CAM 账号只授予上述前缀所需的 `PutObject` 权限。OCR 使用的 CAM 账号授予验真图片桶读权限，以及照片 JSON 桶读写权限。不要在客户端内置永久 SecretId/SecretKey。

## 3. 环境变量

```dotenv
TENCENT_COS_SECRET_ID=后端STS签发账号SecretId
TENCENT_COS_SECRET_KEY=后端STS签发账号SecretKey
TENCENT_COS_REGION=ap-singapore
TENCENT_COS_VERIFY_IMAGE_BUCKET=photocode-verify-images-1330977225
TENCENT_COS_BUCKETS_JSON={"photo_json":{"bucket":"photocode-json-1330977225","region":"ap-singapore","allowRead":false,"allowWrite":true,"validator":"photoJson"},"verify_images":{"bucket":"photocode-verify-images-1330977225","region":"ap-singapore","allowRead":false,"allowWrite":true,"validator":"verifyImage"}}

TP_OCR_BASE_URL=http://tp-ocr:8000
TP_OCR_API_KEY=与OCR_API_KEY相同的强随机值
TP_OCR_CALLBACK_SECRET=与OCR_TASK_CALLBACK_SECRET相同的另一强随机值
```

生产环境的 `TENCENT_COS_BUCKETS_JSON` 可以同时保留已有团队图片桶配置。`photo_json` 和 `verify_images` 是客户端请求 STS 时使用的固定 alias，不要改名。

阿波罗配置 `cos_sts_enable=1` 后，新版客户端使用短期 STS；灰度期间设为 `0` 可暂时保留旧上传路径。正式发布前应确认两个新桶均已授权给 STS 账号。

## 4. 网络与接口

`team_backend` 必须能访问 `TP_OCR_BASE_URL`。OCR 必须能回调公网或内网可达的：

```text
POST /api/photoCode/verify/task/callback
X-Callback-Secret: <TP_OCR_CALLBACK_SECRET>
```

处理中回调除 `taskId`、`status=PROCESSING` 外，还包含 `stage` 和 `stageStatus`；最终成功会将四个阶段全部置为 `COMPLETED`，执行异常会将当前阶段置为 `FAILED`。

客户端接口：

- `POST /api/workgroup/cos/sts`：以 `bucketAlias=photo_json` 或 `verify_images` 获取对应短期凭证。
- `POST /api/photoCode/verify/task`：登录后提交 `{ "imageUrl": "..." }`，创建当前账户名下的任务。
- `POST /api/photoCode/verify/task/status`：登录后提交 `{ "taskID": "..." }`，仅可读取本人任务。

验真图片 URL 必须属于配置的验真桶，且对象键必须为当前用户自己的 `verify/<userID>/...jpg`，后端会拒绝跨账户对象。

## 5. 发布检查

1. 执行 Prisma migration，并确认 `PhotoVerificationTask` 表已创建。
2. 确认两个桶的 CORS 允许 App SDK 上传，桶无需匿名读。
3. 确认 STS 返回的 `bucket/region/keyPrefix` 与请求 alias 一致。
4. 从一个登录账户提交两张照片，确认生成两条任务；一条失败不应改变另一条状态。
5. 确认成功任务保存 `resultObjectKey`，对应 COS 中存在 `code_verify.json`。
6. 确认其他账户查询该 `taskID` 返回任务不存在或无权限。
