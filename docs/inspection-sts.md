# 巡检复用统一 COS 临时凭据接口

2026-11-09。本地实现及腾讯云实际签发/权限验证已完成；线上仍需部署原接口的修改。

沿用 `POST /api/workgroup/v4/oss/sts`，不新增服务或采集判断接口。现有业务桶仍要求登录和原有权限校验；只有固定的 `inspection` 范围允许未登录调用。

```json
{
  "bucketKey": "inspection",
  "objectKey": "samples/v1/live/baseline-v1/ios/iPhone17~2c1/en/ui-v1/ios.page.p000001/none/default.jpg",
  "access": "write"
}
```

客户端顺序：本地去重 → COS HEAD → 仅 404 才调用统一凭据方法 → 核对页面及空闲条件 → 截图 → 图片 PUT → 空 marker PUT。已覆盖组合不申请凭据；没有上传完成业务回调。

一次凭据有效 900 秒，只允许写入此图片和对应 `markers/{Key}.done`。COS 策略强制禁止覆盖；图片最多 600,000 字节，marker 必须 0 字节；没有读取、列举、删除权限。凭据失败时不截图、不上传，不回退客户端长期密钥。图片和 marker 共用一次鉴权请求。

沿用已有 `TENCENT_COS_SECRET_ID` / `TENCENT_COS_SECRET_KEY`；可选使用 `TENCENT_COS_INSPECTION_SECRET_ID` / `TENCENT_COS_INSPECTION_SECRET_KEY` 收窄签发账号。签发账号需具有巡检桶的相应 COS 写入及 STS 签发权限。无需给其他桶增加匿名权限，也不改变现有桶映射 JSON。

入口采用 4 KiB 请求体限制、严格对象键校验、每进程全局 1,200 次/分钟、每 IP 120 次/分钟及 8 个并发签发上限。反向代理必须覆盖客户端传来的 IP 头；多实例部署需在网关配置共享限流。匿名调用不能证明样本真实来自官方 App，额度限制也不等同于设备真实性验证。

验证：`node --import tsx --test scripts/inspection-sts.test.ts`。本机真实 COS 测试确认越权路径、超限图片、非空 marker、无防覆盖头和私有图片读取均返回 403；重复写入返回 409；合法图片及空 marker 成功。合成策略测试对象已删除。

当前线上匿名巡检范围请求返回 401，因此不能把本地成功解释为已上线。总开关沿用当前 Apollo `timeprint_inspection_enable`，本次未修改远程开关值。证据目录：`/tmp/timeprint-inspection-sts-20261109/`。

上线顺序：先部署原 STS 接口修改并验证未登录 inspection 请求成功，再开启巡检总开关。按当前“一次尝试后本地不再请求”的约定，鉴权失败也会留下 attempted；若顺序错误造成漏采，需要新的 collectionId 补采，不能只修服务端后期待同一安装自动重试。

客户端直接复用 iOS `TimeprintTeamSpaceAPI.requestCOSUploadCredential` 和 Android `TimeprintTeamSpaceApi.requestCosUploadCredential`；巡检专用的凭据 HTTP 请求已移除。模拟器通过统一入口真实上传：iOS 反馈页 61,466B；Android 反馈页 38,122B、照片码弹窗 50,653B。图片和 marker 共用一次签发，重复进入不再 HEAD/STS。

iOS 触摸后安静期为 1.2 秒，空闲等待最多 4 秒；即将截图时才检查前台视图及动画，不把弹窗背后的相机动画算作前台交互。后台预分配 BGRA 位图，最长边 1000 像素、约 50 万像素；主线程只绘制，后台编码上传。持续动画或凭据失败时不截图。实测主线程绘制仍约 45–60ms，统一入口复测 51.32ms，尚不能承诺零掉帧。Android 两次截图相关主线程操作约 1.45ms、2.81ms。

新 Android 模拟器首次冷启动曾出现 startup ANR，主线程等待系统 `finishAttachApplication`，巡检线程空闲；重启 App 后两项上传及去重测试成功。相关堆栈保留在证据目录。这些专项测试不替代全机型性能验证。后端专项 9 项测试通过；全库类型检查仍有 21 项其他文件的既有错误，本次修改文件无类型错误。
