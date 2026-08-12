# Timeprint App 接入 Web 扫码登录

本文档提供给 Timeprint iOS / Android 客户端开发，用于实现：用户在 Web 登录页看到二维码，使用已经登录的 Timeprint App 扫描后，Web 自动完成登录。

## 1. 接入目标

完整流程：

1. Web 登录页自动生成并展示二维码。
2. 已登录的 App 使用应用内扫码功能读取二维码。
3. App 携带当前用户的登录 Token 调用扫码确认接口。
4. 服务端将二维码会话绑定到当前 App 用户。
5. Web 轮询到确认状态后自动登录。

App 不需要生成二维码，不需要生成六位登录码，也不需要把用户 ID、邮箱、Google / Apple ID 或 Zalo 用户 ID 传给 Web。

## 2. 生产环境

API Base URL：

```text
https://teamspace.timeprint.net/api
```

二维码内容格式：

```text
https://teamspace.timeprint.net/scan-login?token=<一次性扫码令牌>
```

示例：

```text
https://teamspace.timeprint.net/scan-login?token=QfZ7kL5cV4Yh9x...
```

二维码默认 5 分钟有效，只能绑定一个用户，并且只能用于创建一次 Web 登录会话。

## 3. App 需要调用的接口

### 确认 Web 扫码登录

```http
POST https://teamspace.timeprint.net/api/user/web-login/qr/confirm
Content-Type: application/json
Authorization: Bearer <App 当前登录 Token>
```

推荐直接把扫码得到的完整字符串传给服务端：

```json
{
  "scanURL": "https://teamspace.timeprint.net/scan-login?token=QfZ7kL5cV4Yh9x..."
}
```

App 也可以自行解析 URL，只传 `token` 参数：

```json
{
  "scanToken": "QfZ7kL5cV4Yh9x..."
}
```

服务端兼容以下请求字段：

|字段|内容|建议|
|---|---|---|
|`scanURL`|扫码得到的完整 URL|推荐|
|`scanToken`|URL 中的 `token` 参数|可选|
|`token`|一次性扫码令牌|兼容字段|
|`code`|完整 URL 或一次性扫码令牌|兼容字段|

成功响应：

```json
{
  "confirmed": true,
  "alreadyConfirmed": false
}
```

同一用户重复提交同一个尚未消费的二维码时：

```json
{
  "confirmed": true,
  "alreadyConfirmed": true
}
```

`alreadyConfirmed: true` 仍然表示成功，App 应显示“登录成功”并关闭扫码页面。

## 4. 错误响应

错误响应格式：

```json
{
  "error": "二维码已过期，请刷新后重试"
}
```

|HTTP 状态码|含义|App 建议处理|
|---|---|---|
|`400`|二维码内容不正确|提示“无效的登录二维码”|
|`401`|App Token 无效或登录已过期|进入 App 重新登录流程|
|`404`|二维码不存在或已经失效|提示用户刷新 Web 二维码后重试|
|`409`|二维码已被其他用户确认或已经使用|提示二维码已失效，重新扫码|
|`410`|二维码超过有效期|提示用户刷新 Web 二维码后重试|
|`500`|服务端异常|提示稍后重试|

错误提示应优先显示响应中的 `error` 字段。

## 5. 二维码识别规则

App 扫描到内容后，建议先执行以下校验：

1. 内容必须是 HTTPS URL。
2. Host 必须是 `teamspace.timeprint.net`。
3. Path 必须是 `/scan-login`。
4. Query 中必须有非空的 `token` 参数。

校验通过后调用确认接口。不要使用系统浏览器打开这个 URL，也不要把扫码令牌保存到日志、埋点或本地持久化存储。

为了兼容测试环境或后续域名调整，也可以不在客户端解析 URL，直接将完整扫码内容放入 `scanURL` 提交，由服务端解析和校验令牌。

## 6. iOS 接入示例

以下为 Swift 风格示例，网络层名称可替换为项目现有实现：

```swift
struct WebQrLoginRequest: Encodable {
    let scanURL: String
}

struct WebQrLoginResponse: Decodable {
    let confirmed: Bool
    let alreadyConfirmed: Bool
}

struct ApiError: Decodable {
    let error: String
}

enum WebQrLoginError: Error {
    case server(String)
}

func confirmWebLogin(scannedValue: String, appToken: String) async throws {
    let url = URL(string: "https://teamspace.timeprint.net/api/user/web-login/qr/confirm")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(appToken)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONEncoder().encode(WebQrLoginRequest(scanURL: scannedValue))

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else { return }
    guard (200...299).contains(httpResponse.statusCode) else {
        let apiError = try? JSONDecoder().decode(ApiError.self, from: data)
        throw WebQrLoginError.server(apiError?.error ?? "Unable to confirm login")
    }

    let result = try JSONDecoder().decode(WebQrLoginResponse.self, from: data)
    if result.confirmed {
        // 显示成功状态并关闭扫码页面。
    }
}
```

## 7. Android 接入示例

以下为 Kotlin / Retrofit 风格示例。假设 Retrofit Base URL 为 `https://teamspace.timeprint.net/`：

```kotlin
data class WebQrLoginRequest(
    val scanURL: String
)

data class WebQrLoginResponse(
    val confirmed: Boolean,
    val alreadyConfirmed: Boolean
)

interface WebLoginApi {
    @POST("api/user/web-login/qr/confirm")
    suspend fun confirmWebLogin(
        @Header("Authorization") authorization: String,
        @Body body: WebQrLoginRequest
    ): WebQrLoginResponse
}

suspend fun confirmWebLogin(scannedValue: String, appToken: String) {
    val result = api.confirmWebLogin(
        authorization = "Bearer $appToken",
        body = WebQrLoginRequest(scanURL = scannedValue)
    )
    if (result.confirmed) {
        // 显示成功状态并关闭扫码页面。
    }
}
```

## 8. 推荐交互

1. 用户进入 App 扫码页面。
2. 识别二维码后立即暂停相机识别，防止重复请求。
3. 显示“正在确认 Web 登录”。
4. 调用确认接口。
5. 成功后显示“Web 登录成功”，然后关闭扫码页面。
6. 请求失败时恢复扫码能力，允许用户重试。

App 已经登录 Google、Apple、Zalo 或邮箱账号都使用同一个确认接口。服务端根据 Bearer Token 识别当前用户，与登录来源无关。

## 9. 安全说明

- 二维码中只有一次性随机令牌，不包含用户 ID、邮箱或 Web 登录 Token。
- App 必须携带有效的用户 Bearer Token 才能确认二维码。
- 第一个成功确认二维码的用户会绑定该登录会话，其他用户不能覆盖。
- Web 还持有一个不会写入二维码的浏览器私钥；仅凭二维码内容不能领取 Web 登录 Token。
- 二维码过期或被使用后不能再次创建新的 Web 登录会话。

## 10. 联调检查清单

- App 未登录时不能确认二维码，接口返回 `401`。
- App 登录后扫描有效二维码，接口返回 `confirmed: true`。
- 确认成功后 Web 在几秒内自动进入 Dashboard。
- 同一用户重复提交时返回成功，`alreadyConfirmed: true`。
- 第二个用户不能覆盖第一个已确认用户。
- 二维码过期后返回 `410`。
- Web 刷新二维码后，旧二维码不可继续使用。
- iOS 和 Android 均不会把扫码 URL、扫码令牌写入日志或统计事件。

## 11. 旧版登录码

旧版六位登录码接口目前仍保留用于兼容已发布版本，但新版本 App 不需要接入：

```text
POST /api/user/web-login/code/create
POST /api/user/login/web-code
```

新版本统一使用本文件中的二维码确认接口。
