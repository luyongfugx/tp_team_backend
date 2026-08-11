# Timeprint App Zalo 登录接入文档

本文档面向 iOS / Android App 开发，用于接入 Timeprint TeamSpace 后端的 Zalo 登录接口。

## 1. 登录流程

App 端负责调用 Zalo SDK 登录，并从 Zalo SDK 返回结果中获取 Zalo 用户 ID、昵称、头像，然后把这些资料发给 Timeprint 后端登录接口。

临时说明：由于当前 Timeprint 服务器部署在新加坡，Zalo 对新加坡机器的服务端 token 校验 / 用户资料请求存在拦截，Zalo 登录暂时由 App 端完成 Zalo SDK 登录，后端直接兼容 App 传入的 Zalo 用户资料创建或登录 Timeprint 用户。

## 2. Zalo App 配置

Zalo App ID：

```text
1544975324139938351
```

允许的 redirect uri：

```text
timeprint://auth/zalo
https://teamspace.timeprint.net/auth/zalo/callback
```

说明：这里的 Zalo App ID 是 Zalo Developer 平台里的 App ID，不是 Apple Developer App ID，也不是 Android package name。

## 3. 接口地址

生产环境：

```http
POST https://teamspace.timeprint.net/api/user/login/zalo
Content-Type: application/json
```

## 4. 请求参数

```json
{
  "zaloUserID": "123456789",
  "userName": "Zalo User",
  "avatar": "https://...",
  "appInstanceID": "device-instance-id",
  "platform": "ios",
  "device_id": "device-unique-id",
  "App-UUID": "device-unique-id",
  "App-Version": "1.2.3",
  "versionCode": "123",
  "device model": "iPhone16,2",
  "realTimeZone": "Asia/Shanghai",
  "systemTimeZone": "Asia/Shanghai",
  "countryCode": "CN",
  "appLan": "zh-Hans",
  "fullapplan": "zh-Hans"
}
```

## 5. 字段说明

| 字段 | 必填 | 说明 |
|---|---:|---|
| `zaloUserID` | 是 | Zalo SDK 登录成功后返回的 Zalo 用户 ID。也兼容字段名 `zaloUserId` / `zalo_user_id` / `zaloID` / `id` / `userID` |
| `userName` | 否 | Zalo 用户昵称。也兼容字段名 `name` / `zaloName` |
| `avatar` | 否 | Zalo 用户头像 URL。也兼容字段名 `picture` / `pictureUrl` / `avatarUrl` / `zaloAvatar` |
| `appInstanceID` | 否 | 设备实例 ID |
| `platform` | 否 | `ios` 或 `android` |
| `device_id` | 否 | 设备唯一标识 |
| `App-UUID` | 否 | 当前与 `device_id` 相同 |
| `App-Version` | 否 | App 版本号 |
| `versionCode` | 否 | App Build 版本号 |
| `device model` | 否 | 硬件型号 |
| `realTimeZone` | 否 | 获取的可信时区 |
| `systemTimeZone` | 否 | 系统当前时区 |
| `countryCode` | 否 | ISO 国家/地区代码 |
| `appLan` | 否 | App 当前语言标识 |
| `fullapplan` | 否 | 完整语言标识，目前值与 `appLan` 相同 |

## 6. 成功响应

```json
{
  "success": true,
  "userID": "user_xxx",
  "userName": "Zalo User",
  "avatar": "https://...",
  "shortName": null,
  "ownerTeamCount": 1,
  "token": "login-token",
  "expiresAt": "2026-09-10T12:00:00.000Z",
  "email": "",
  "user": {
    "id": "user_xxx",
    "email": ""
  },
  "isNewUser": false,
  "groupID": "group_xxx",
  "zaloUserID": "123456789"
}
```

## 7. 登录后 token 使用方式

客户端登录成功后，请保存返回的 `token`。后续需要登录态的接口通过 Header 传：

```http
Authorization: Bearer <token>
```

## 8. 关于邮箱

Zalo 通常不返回邮箱。服务端不会再生成占位邮箱，Zalo 首次登录创建的用户 `email` 存为空值；接口响应里的 `email` 返回空字符串 `""`。

## 9. 错误响应

```json
{
  "error": "错误信息"
}
```

常见错误：

| HTTP 状态码 | 说明 |
|---:|---|
| 400 | 参数错误，例如缺少 `zaloUserID` |
| 401 | 未登录或 token 过期 |
| 500 | 服务端错误 |

## 10. App 端注意事项

1. App 端必须先通过 Zalo SDK 完成登录，再把 SDK 返回的 Zalo 用户资料传给后端。
2. 当前临时兼容方案下，后端必填的是 `zaloUserID`。
3. `userName`、`avatar` 建议一起传，用于初始化 Timeprint 用户昵称和头像。
4. `device_id`、`App-Version`、`platform`、语言、国家等设备信息建议一起传，后端会在用户字段为空时自动补写。
5. 后续如果 Zalo 放开新加坡服务器访问，后端可能恢复 `code + codeVerifier` 的服务端校验方案。
