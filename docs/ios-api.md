# 团队水印相机 iOS API 文档

本文档面向 iOS 客户端调用。接口路径以当前 Next.js API 路由为准，所有路径均为 `POST`，请求和响应均使用 JSON。

## 1. 通用约定

### Base URL

开发或测试环境由服务端部署地址决定，例如：

```text
https://your-domain.com/api
```

文档中的接口路径均省略 `/api` 前缀。例如文档写 `user/login/vericode`，实际请求为：

```text
POST https://your-domain.com/api/user/login/vericode
```

### Header

除发送验证码、验证码登录、邀请加入时未登录场景外，其余接口都需要登录 token：

```http
Content-Type: application/json
Authorization: Bearer <token>
```

发送邮箱验证码接口可额外带：

```http
email: user@example.com
x-sign-id: md5(email + signKey)
```

如果服务端未配置 `EMAIL_SIGN_KEY`，签名不强制校验。

### 通用成功响应

无返回数据时：

```json
{}
```

有返回数据时按接口说明返回，例如：

```json
{
  "token": "xxx"
}
```

### 通用错误响应

```json
{
  "error": "错误信息"
}
```

常见 HTTP 状态码：

|状态码|说明|
|---|---|
|`400`|参数错误|
|`401`|未登录或 token 过期|
|`403`|无权限|
|`429`|验证码发送过于频繁|
|`500`|服务端错误|

### 角色

|roleID|role|说明|
|---|---|---|
|`1`|`OWNER` / 创建者|团队创建者|
|`2`|`ADMIN` / 管理员|团队管理员|
|`3`|`MEMBER` / 普通成员|普通成员|

### 媒体类型

|mediaType|说明|
|---|---|
|`0`|照片|
|`1`|视频|
|`2`|考勤|

## 2. 推荐调用流程

1. `user/vericode/send` 发送邮箱验证码。
2. `user/login/vericode` 使用验证码登录，保存返回的 `token`。
3. 首次登录时，如果用户没有待处理团队邀请，且没有所属团队，服务端会自动创建一个默认团队，团队名格式为 `username's team`。
4. `group/list` 获取团队列表。
5. 用户可以加入或创建多个团队；也可以调用 `group/create` 手动创建团队。
6. 管理员或创建者调用 `group/project/create` 创建项目。
7. 成员拍照后调用 `photo/upload` 上传照片记录。
8. 调用 `photo/list/v1` 查看团队或项目照片。

## 3. 用户 / 登录

### 发送邮箱验证码

```text
POST user/vericode/send
```

请求：

```json
{
  "email": "user@example.com"
}
```

响应：

```json
{}
```

### 验证码登录

```text
POST user/login/vericode
```

请求：

```json
{
  "email": "user@example.com",
  "loginType": 0,
  "veriCode": "123456",
  "avatar": "https://example.com/avatar.png",
  "userName": "Wayne",
  "appInstanceID": "ios-device-instance-id"
}
```

`loginType`：

|值|说明|
|---|---|
|`0`|邮箱验证码|
|`1`|Google|
|`2`|Microsoft|
|`3`|邀请登录|

响应：

```json
{
  "userID": "user_xxx",
  "userName": "Wayne",
  "avatar": "https://example.com/avatar.png",
  "shortName": null,
  "ownerTeamCount": 1,
  "token": "login-token",
  "email": "user@example.com",
  "isNewUser": false,
  "groupID": "group_xxx"
}
```

### Apple 账户登录

```text
POST user/login/apple
```

请求：

```json
{
  "identityToken": "apple-jwt-identity-token",
  "rawNonce": "optional-raw-nonce",
  "nonce": "optional-sha256-nonce",
  "email": "user@example.com",
  "fullName": {
    "givenName": "Wayne",
    "familyName": "Lu"
  },
  "userName": "Wayne Lu",
  "avatar": "https://example.com/avatar.png",
  "appInstanceID": "ios-device-instance-id"
}
```

字段说明：

|字段|说明|
|---|---|
|`identityToken`|必填，iOS `ASAuthorizationAppleIDCredential.identityToken` 转成 UTF-8 字符串后传给后端|
|`rawNonce`|可选，如果客户端发起 Apple 登录时设置了 raw nonce，传原始值；后端会 SHA256 后与 token 内 `nonce` 比对|
|`nonce`|可选，如果客户端只保存了已 SHA256 的 nonce，可直接传该值|
|`email`|可选兜底；Apple 通常只在首次授权返回邮箱，后端优先使用 identityToken 内的 email|
|`fullName` / `userName`|可选；Apple 通常只在首次授权返回姓名|
|`appInstanceID`|可选，设备实例 ID|

响应：

```json
{
  "userID": "user_xxx",
  "userName": "Wayne Lu",
  "avatar": null,
  "shortName": null,
  "ownerTeamCount": 1,
  "token": "login-token",
  "email": "user@example.com",
  "isNewUser": false,
  "groupID": "group_xxx"
}
```

服务端会校验 Apple `identityToken` 的签名、`iss`、`aud`、过期时间和可选 nonce。首次 Apple 登录必须拿到邮箱；后续 Apple 可能不再返回邮箱，后端会通过 Apple `sub` 绑定的账号登录。

服务端环境变量：

```text
APPLE_CLIENT_IDS=com.example.ios.bundle
```

如果有多个 Apple client id / bundle id，用英文逗号分隔：

```text
APPLE_CLIENT_IDS=com.example.ios.bundle,com.example.web.service
```

### Google 账户登录

```text
POST user/login/google
```

请求：

```json
{
  "identityToken": "google-id-token",
  "nonce": "optional-nonce",
  "userName": "Wayne Lu",
  "avatar": "https://lh3.googleusercontent.com/xxx",
  "appInstanceID": "ios-device-instance-id"
}
```

字段说明：

|字段|说明|
|---|---|
|`identityToken` / `idToken`|必填，Google Sign-In SDK 返回的 ID Token。后端只信这个 token，不信客户端直接传的 Google user id|
|`nonce`|可选，如果客户端发起 Google 登录时设置了 nonce，传同一个 nonce；后端会与 token 内 `nonce` 比对|
|`userName`|可选；不传时后端会优先使用 Google token 内的 `name`|
|`avatar`|可选；不传时后端会优先使用 Google token 内的 `picture`|
|`appInstanceID`|可选，设备实例 ID|

响应：

```json
{
  "userID": "user_xxx",
  "userName": "Wayne Lu",
  "avatar": "https://lh3.googleusercontent.com/xxx",
  "shortName": null,
  "ownerTeamCount": 1,
  "token": "login-token",
  "email": "user@example.com",
  "isNewUser": false,
  "groupID": "group_xxx"
}
```

服务端会校验 Google `identityToken` 的签名、`iss`、`aud`、过期时间和可选 nonce，并要求 `email_verified=true`。首次 Google 登录如果该邮箱没有待加入邀请且没有所属团队，会自动创建默认团队。

服务端环境变量：

```text
GOOGLE_CLIENT_IDS=your-web-server-client-id.apps.googleusercontent.com
```

如果后续多个客户端共用后端，可以用英文逗号分隔：

```text
GOOGLE_CLIENT_IDS=web-client-id.apps.googleusercontent.com,ios-client-id.apps.googleusercontent.com
```

建议优先配置 Web application 类型的 server client ID，并在 iOS `Info.plist` 的 `GIDServerClientID` 中使用同一个值。

### 刷新 token

```text
POST user/token/refresh
```

请求：

```json
{
  "appInstanceID": "ios-device-instance-id"
}
```

响应：

```json
{
  "token": "new-token"
}
```

### 退出登录

```text
POST user/logout
```

请求：

```json
{
  "email": "user@example.com",
  "userName": "Wayne"
}
```

响应：

```json
{}
```

### 查询用户信息

```text
POST user/info/query
```

请求：

```json
{
  "userID": ["user_1", "user_2"]
}
```

响应：

```json
{
  "userInfo": [
    {
      "userID": "user_1",
      "userName": "Wayne",
      "shortName": "W",
      "avatar": "https://example.com/avatar.png",
      "email": "wayne@example.com"
    }
  ]
}
```

### 更新用户名

```text
POST user/name/update
```

请求：

```json
{
  "userName": "New Name"
}
```

响应：

```json
{}
```

### 更新用户资料

```text
POST user/info/update
```

请求：

```json
{
  "userName": "New Name",
  "avatar": "https://example.com/new-avatar.png",
  "email": "new@example.com"
}
```

响应：

```json
{
  "userID": "user_xxx",
  "userName": "New Name",
  "avatar": "https://example.com/new-avatar.png",
  "shortName": null,
  "email": "new@example.com",
  "selectedGroupID": "group_xxx",
  "selectedProjectID": 1
}
```

### 查询当前用户选中的团队和项目

```text
POST user/selection/query
```

请求：

```json
{}
```

响应：

```json
{
  "selectedGroupID": "group_xxx",
  "selectedProjectID": 1,
  "role": "创建者",
  "roleID": 1,
  "selectedTeam": {
    "groupID": "group_xxx",
    "groupName": "Wayne's team",
    "role": "创建者",
    "roleID": 1
  },
  "selectedProject": {
    "projectID": 1,
    "projectName": "上海项目"
  }
}
```

如果当前没有选中团队或项目，对应字段返回 `null`。服务端会校验选中团队必须是当前用户已加入的团队；如果已保存的团队或项目失效，查询接口返回 `null`。

### 修改当前用户选中的团队和项目

```text
POST user/selection/update
```

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 1
}
```

也支持使用字段名 `selectedGroupID`、`selectedProjectID`。

`projectID` 可传 `0` 或 `null`，表示只选中团队，不选中任何项目。

响应：

```json
{
  "selectedGroupID": "group_xxx",
  "selectedProjectID": 1,
  "role": "创建者",
  "roleID": 1
}
```

`roleID`：`1` 创建者，`2` 管理员，`3` 普通成员。

三个字段都可选；传 `email` 时服务端会校验邮箱格式和唯一性。

### 删除账号

```text
POST user/delete
```

请求：

```json
{}
```

响应：

```json
{}
```

注销账号会删除该用户资料、会话、验证码、该用户创建的团队及其关联数据、该用户在其他团队内的成员关系和照片记录。该操作不可恢复。

### 获取 Web token

```text
POST user/account/token
```

请求：

```json
{}
```

响应：

```json
{
  "accountToken": "temporary-account-token"
}
```

## 4. 团队

### 团队列表

```text
POST group/list
```

请求：

```json
{}
```

同步当前用户团队设置时可传：

```json
{
  "groupID": "group_xxx",
  "settings": [
    {
      "settingKey": "key",
      "settingValue": "value"
    }
  ]
}
```

响应：

```json
{
  "groups": [
    {
      "groupID": "group_xxx",
      "groupName": "工程一队",
      "role": "创建者",
      "roleID": 1,
      "userSettings": [],
      "projects": [],
      "memberNum": 3,
      "memberSubscriptionInfo": null,
      "accessControl": null,
      "syncNum": 0,
      "isNew": true
    }
  ]
}
```

### 首页聚合接口

```text
POST group/home
```

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": null,
  "pageIndex": 1,
  "pageSize": 60,
  "timezone": "Asia/Shanghai"
}
```

响应固定为 `{ "code": 0, "data": { ... } }`。认证失败时 `code = 401`；参数或权限错误会返回对应 `code` 和 `message/error`。

`groupID` 不传时，服务端优先使用用户上次选中的团队，再使用用户加入的第一个团队。传入有效 `groupID` 后，服务端会保存为该用户当前选中团队。

`projectID`：

- 传项目 ID：照片流只返回该项目照片。
- 传 `null`：照片流返回团队全部照片，包括项目照片和 `projectID = null` 的团队级照片。
- 不传：服务端使用用户上次选中的项目状态；如果上次就是 `null`，继续返回团队全部照片。

响应示例：

```json
{
  "code": 0,
  "data": {
    "setupStep": "teamHome",
    "selectedGroupID": "group_xxx",
    "selectedProjectID": null,
    "selectedGroup": {
      "groupID": "group_xxx",
      "groupName": "Wayne's Team",
      "role": "创建者",
      "roleID": 1,
      "memberNum": 4,
      "syncNum": 86
    },
    "selectedProject": null,
    "pendingInvite": null,
    "groups": [
      {
        "groupID": "group_xxx",
        "groupName": "Wayne's Team",
        "role": "创建者",
        "roleID": 1,
        "memberNum": 4,
        "syncNum": 86,
        "defaultSelect": 123,
        "projects": [],
        "members": []
      }
    ],
    "photos": {
      "totalCount": 86,
      "pageIndex": 1,
      "pageSize": 60,
      "hasMore": true,
      "list": []
    },
    "homeStats": {
      "memberCount": 4,
      "projectCount": 2,
      "syncCount": 86,
      "todayPhotoCount": 5,
      "todayActiveMemberCount": 2,
      "todayInactiveMemberCount": 2,
      "latestPhotoID": "photo_xxx"
    }
  }
}
```

`setupStep`：

- `teamHome`：用户已有团队且已有项目，首页可直接展示。
- `joinTeam`：用户没有团队，但有待加入邀请，返回 `pendingInvite`。
- `createTeam`：用户没有团队，也没有待加入邀请。
- `createProject`：用户有团队但没有项目。

`pendingInvite` 字段等价于原来的 `group/user/invite/list` 首条待加入邀请。

### 创建团队

```text
POST group/create
```

请求：

```json
{
  "groupName": "工程一队"
}
```

响应：

```json
{
  "groupInfo": {
    "groupID": "group_xxx",
    "groupName": "工程一队",
    "role": "创建者",
    "roleID": 1,
    "projects": [],
    "memberNum": 1
  }
}
```

### 修改团队名

```text
POST group/name/update
```

请求：

```json
{
  "groupID": "group_xxx",
  "groupName": "新团队名"
}
```

响应：

```json
{}
```

### 更新当前用户团队设置

```text
POST group/user/setting/update
```

请求：

```json
{
  "groupID": "group_xxx",
  "settings": [
    {
      "settingKey": "defaultProjectID",
      "settingValue": "1"
    }
  ]
}
```

响应：

```json
{
  "accessControl": null
}
```

### 团队级设置

团队级设置用于保存适用于整个团队的多项配置，例如“照片来源与上传权限”“自动保存到相册策略”等。每一项设置是一条记录，按 `groupID + name` 唯一。

字段：

|字段|说明|
|---|---|
|`id`|设置记录 ID|
|`groupID`|所属团队 ID|
|`name`|设置名称，客户端传入，建议使用英文 key，例如 `photoUploadPermission`|
|`value`|设置值，JSON 类型，可以是 string、number、boolean、object、array 或 null|
|`createdAt`|创建时间|
|`updatedAt`|更新时间|

`name` 规则：必须以英文字母开头，最多 64 个字符；允许英文字母、数字、下划线、点、冒号、短横线。

这些接口使用固定响应格式：

成功：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

失败：

```json
{
  "code": 400,
  "message": "参数不正确",
  "data": null
}
```

权限：

|接口|权限|
|---|---|
|`group/setting/list`|团队成员可读|
|`group/setting/query`|团队成员可读|
|`group/setting/create`|团队创建者 / 管理员|
|`group/setting/update`|团队创建者 / 管理员|
|`group/setting/delete`|团队创建者 / 管理员|

#### 设置列表

```text
POST group/setting/list
```

请求：

```json
{
  "groupID": "group_xxx",
  "names": ["photoUploadPermission", "autoSaveAlbum"]
}
```

说明：`names` 可选；不传或为空时返回该团队所有设置。

响应：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "settings": [
      {
        "id": "setting_xxx",
        "groupID": "group_xxx",
        "name": "photoUploadPermission",
        "value": "timeprint_photo_only",
        "createdAt": "2026-07-23T00:00:00.000Z",
        "updatedAt": "2026-07-23T00:00:00.000Z"
      }
    ]
  }
}
```

#### 查询单项设置

```text
POST group/setting/query
```

请求：

```json
{
  "groupID": "group_xxx",
  "name": "photoUploadPermission"
}
```

响应：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "setting": {
      "id": "setting_xxx",
      "groupID": "group_xxx",
      "name": "photoUploadPermission",
      "value": "timeprint_photo_only",
      "createdAt": "2026-07-23T00:00:00.000Z",
      "updatedAt": "2026-07-23T00:00:00.000Z"
    }
  }
}
```

#### 创建设置

```text
POST group/setting/create
```

请求：

```json
{
  "groupID": "group_xxx",
  "name": "photoUploadPermission",
  "value": "timeprint_photo_only"
}
```

说明：如果同一团队下 `name` 已存在，返回 `设置已存在`。需要允许覆盖时请使用更新接口。

响应：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "setting": {
      "id": "setting_xxx",
      "groupID": "group_xxx",
      "name": "photoUploadPermission",
      "value": "timeprint_photo_only",
      "createdAt": "2026-07-23T00:00:00.000Z",
      "updatedAt": "2026-07-23T00:00:00.000Z"
    }
  }
}
```

#### 更新设置

```text
POST group/setting/update
```

请求：

```json
{
  "groupID": "group_xxx",
  "name": "photoUploadPermission",
  "value": "timeprint_photo_only"
}
```

说明：更新接口是 upsert 语义；如果记录不存在会自动创建。

响应：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "setting": {
      "id": "setting_xxx",
      "groupID": "group_xxx",
      "name": "photoUploadPermission",
      "value": "timeprint_photo_only",
      "createdAt": "2026-07-23T00:00:00.000Z",
      "updatedAt": "2026-07-23T00:00:00.000Z"
    }
  }
}
```

#### 删除设置

```text
POST group/setting/delete
```

请求：

```json
{
  "groupID": "group_xxx",
  "name": "photoUploadPermission"
}
```

响应：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

示例设置值：

```json
{
  "photoUploadPermission": "timeprint_photo_only",
  "autoSaveAlbum": "save_to_device"
}
```

### 退出团队

```text
POST group/user/exit
```

当前登录用户主动退出团队。

请求：

```json
{
  "groupID": "group_xxx"
}
```

响应：

```json
{}
```

规则：

- 需要登录。
- 普通成员、管理员可主动退出。
- 创建者不能直接退出，需要先调用团队转让接口。
- 退出后会删除该用户在团队下的项目成员关系。

### 加入团队

```text
POST group/user/join
```

已登录用户可直接传邀请信息；未登录用户需要同时传邮箱验证码。

请求：

```json
{
  "groupID": "group_xxx",
  "uuID": "invite-uuid",
  "code": "123456",
  "loginType": 3,
  "inviteLinkWay": "LINK",
  "email": "user@example.com",
  "veriCode": "123456",
  "avatar": "https://example.com/avatar.png",
  "userName": "Wayne",
  "appInstanceID": "ios-device-instance-id"
}
```

邮箱邀请加入时，`inviteLinkWay` 传 `EMAIL`，`code` 可替代 `uuID`。

响应：

```json
{
  "userID": "user_xxx",
  "userName": "Wayne",
  "avatar": "https://example.com/avatar.png",
  "shortName": null,
  "token": "login-token",
  "email": "user@example.com",
  "groupID": "group_xxx"
}
```

### 删除团队

```text
POST group/delete
```

请求：

```json
{
  "groupID": "group_xxx"
}
```

响应：

```json
{}
```

仅创建者可操作。注销团队会删除该团队、成员、项目、照片、分享、打包任务、PDF 设置和邀请记录。该操作不可恢复。

### 转让团队

```text
POST group/transfer
```

请求：

```json
{
  "groupID": "group_xxx",
  "newOwnerID": "user_new_owner"
}
```

响应：

```json
{}
```

仅创建者可转让。

## 5. 成员

### 成员列表

```text
POST group/user/list
```

请求：

```json
{
  "groupID": "group_xxx"
}
```

响应：

```json
{
  "users": [
    {
      "userID": "user_xxx",
      "userName": "Wayne",
      "shortName": "W",
      "avatar": "https://example.com/avatar.png",
      "role": "管理员",
      "roleID": 2,
      "photoCount": 12,
      "latestPhotoTimeInterval": 3600000,
      "latestPhotoTimestamp": 1710000000000,
      "latestPhotoSmallURL": "https://example.com/photo-small.jpg"
    }
  ]
}
```

### 移除成员

```text
POST group/user/delete
```

团队创建者或管理员移除团队成员。

请求：

```json
{
  "groupID": "group_xxx",
  "deletedUserIDs": ["user_1", "user_2"]
}
```

响应：

```json
{
  "deletedCount": 2,
  "deletedUserIDs": ["user_1", "user_2"]
}
```

规则：

- 需要登录。
- 只有团队创建者或管理员可操作。
- 不能通过此接口移除自己。
- 不能移除团队创建者。
- 成员被移除后，会同步删除该用户在团队下的项目成员关系。

### 更新成员角色

```text
POST group/user/role/update
```

设置团队成员角色为管理员或普通成员。

请求：

```json
{
  "groupID": "group_xxx",
  "userID": "user_xxx",
  "roleID": 2
}
```

响应：

```json
{
  "userID": "user_xxx",
  "role": "ADMIN",
  "roleID": 2
}
```

`roleID`：

- `2`：管理员。
- `3`：普通成员。

规则：

- 需要登录。
- 仅团队创建者可操作。
- 不能修改自己的创建者角色。
- 不能通过此接口设置创建者；转让创建者请使用 `group/transfer`。
- 成员角色更新后，会同步更新该用户在团队下所有项目里的角色。

### 查询邀请链接

```text
POST group/invite/link/query
```

请求：

```json
{
  "groupID": "group_xxx"
}
```

响应：

```json
{
  "uuID": "invite-uuid"
}
```

### 查询或生成团队码

```text
POST group/invite/code/query
```

请求：

```json
{
  "groupID": "group_xxx",
  "roleID": 3
}
```

响应：

```json
{
  "teamCode": "123456",
  "role": "普通成员",
  "roleID": 3,
  "expiresAt": null
}
```

仅团队创建者或管理员可操作。若团队已有有效团队码，直接返回已有团队码；否则生成新的 6 位团队码。`roleID` 可选，默认普通成员。

### 通过团队码加入团队

```text
POST group/user/join/code
```

请求：

```json
{
  "teamCode": "123456",
  "appInstanceID": "ios-device-instance-id"
}
```

响应：

```json
{
  "userID": "user_xxx",
  "userName": "Wayne",
  "avatar": null,
  "shortName": null,
  "token": "login-token",
  "email": "user@example.com",
  "groupID": "group_xxx",
  "groupName": "团队名称",
  "role": "普通成员",
  "roleID": 3
}
```

需要登录。用户输入团队码后即可加入对应团队；如果已经在团队内，接口保持幂等并返回成功。

### 查询可邀请角色

```text
POST group/user/invite/role/list
```

请求：

```json
{
  "groupID": "group_xxx"
}
```

响应：

```json
{
  "roles": [
    {
      "role": "管理员",
      "roleID": 2
    },
    {
      "role": "普通成员",
      "roleID": 3
    }
  ]
}
```

### 邮件邀请

```text
POST group/user/invite/email
```

该接口会直接把邮箱对应的用户加入团队，并发送通知邮件，不再需要被邀请用户点击同意。

规则：

- 如果邮箱对应用户已存在：直接加入团队。
- 如果邮箱对应用户不存在：自动用该邮箱创建用户，并加入团队。
- 如果该用户已经是团队成员：不会重复加入，也不会发送通知邮件。
- 该接口只允许设置 `roleID=2` 管理员或 `roleID=3` 普通成员；其他值按普通成员处理。

请求：

```json
{
  "groupID": "group_xxx",
  "roleID": 3,
  "emails": ["a@example.com", "b@example.com"]
}
```

响应：

```json
{
  "succeedSendEmails": ["a@example.com"],
  "failedSendEmails": [],
  "invalidEmails": [],
  "alreadyMemberEmails": ["b@example.com"],
  "joinedEmails": ["a@example.com"],
  "createdUserEmails": ["a@example.com"],
  "inviteCodes": {
    "a@example.com": "123456"
  }
}
```

接口会直接把已存在用户或自动注册的新用户加入团队，同时仍会写入 `TeamEmailInvite` 记录，记录里的 `acceptedAt` 为当前时间。邮件内容为“xxx 把您加入 xxx团队”，按钮文案为“查看”。邮件里的查看链接格式：

```text
https://share.timeprint.net/invite?code=123456
```

其中 `code` 的值为 `TeamEmailInvite.inviteCode`，仍是 6 位数字邀请码，方便 `https://share.timeprint.net/invite` 页面按邀请码查询这条邀请记录。

### 根据邀请码查询邀请信息

```text
GET group/user/invite/code/query?code=123456
POST group/user/invite/code/query
```

该接口不需要登录，支持跨域访问。POST 请求体：

```json
{
  "code": "123456"
}
```

如果 `code` 命中团队码，响应中的 `inviteLinkWay` 为 `TEAM_CODE`，并同时返回 `inviteCode` 和 `teamCode`，二者值相同，客户端可继续使用 `inviteCode` 解码。

响应：

```json
{
  "invite": {
    "inviteCode": "123456",
    "inviteLinkWay": "EMAIL",
    "role": "普通成员",
    "roleID": 3,
    "isExpired": false,
    "isAccepted": false,
    "canJoin": true,
    "createdAt": "2026-06-14T00:00:00.000Z",
    "expiresAt": "2026-06-21T00:00:00.000Z",
    "acceptedAt": null,
    "inviter": {
      "id": "user_inviter",
      "userName": "邀请人",
      "shortName": null,
      "avatar": null,
      "email": "inviter@example.com"
    },
    "invitedUser": {
      "id": "user_invited",
      "userName": "被邀请人",
      "shortName": null,
      "avatar": null,
      "email": "a@example.com"
    },
    "team": {
      "groupID": "group_xxx",
      "groupName": "团队名称",
      "memberNum": 3,
      "owner": {
        "id": "user_owner",
        "userName": "创建者",
        "shortName": null,
        "avatar": null,
        "email": "owner@example.com"
      }
    }
  }
}
```

### 查询当前用户收到的团队邀请

```text
POST group/user/invite/list
```

请求：

```json
{}
```

响应：

```json
{
  "invites": [
    {
      "inviteID": "invite_xxx",
      "groupID": "group_xxx",
      "groupName": "团队名称",
      "inviteCode": "123456",
      "uuID": "123456",
      "inviteLinkWay": "EMAIL",
      "role": "普通成员",
      "roleID": 3,
      "email": "user@example.com",
      "memberNum": 3,
      "owner": {
        "id": "user_xxx",
        "userName": "Wayne",
        "shortName": null,
        "avatar": null,
        "email": "owner@example.com"
      },
      "expiresAt": "2026-06-21T00:00:00.000Z",
      "createdAt": "2026-06-14T00:00:00.000Z"
    }
  ]
}
```

仅返回当前登录用户邮箱对应、未过期、未接受、且当前用户尚未加入的团队邀请。点击加入时将列表中的 `groupID`、`inviteCode` 或 `uuID`、`inviteLinkWay` 传给 `group/user/join`。

## 6. 权限

### 查询权限

```text
POST group/role/query
```

请求：

```json
{
  "groupID": "group_xxx"
}
```

响应：

```json
{
  "accessControl": {
    "role": "管理员",
    "roleID": 2,
    "projectManageAC": 3,
    "projectAC": [
      {
        "projectID": 0,
        "ac": 31
      }
    ]
  }
}
```

项目管理权限：

|值|说明|
|---|---|
|`1`|创建项目|
|`2`|更新项目|
|`3`|全部|

项目照片权限：

|值|说明|
|---|---|
|`1`|查看|
|`2`|上传|
|`4`|移动|
|`8`|删除|
|`16`|分享|
|`31`|全部|

## 7. 项目

### 项目列表

```text
POST group/project/list
```

请求：

```json
{
  "groupID": "group_xxx",
  "lat": 31.2304,
  "lng": 121.4737,
  "ac": 31
}
```

响应：

```json
{
  "defaultSelect": 1,
  "projects": [
    {
      "projectID": 1,
      "projectName": "上海项目",
      "photoCount": 10,
      "latestPhotoTimestamp": 1710000000000,
      "latestPhotoSmallURL": "https://example.com/photo-small.jpg",
      "addressInfo": {
        "lat": 31.2304,
        "lng": 121.4737,
        "address": "上海市",
        "circle": 500,
        "distanceUnit": "m",
        "distance": 120,
        "removeAddress": false
      },
      "microBind": null
    }
  ]
}
```

### 创建项目

```text
POST group/project/create
```

请求：

```json
{
  "groupID": "group_xxx",
  "groupName": "工程一队",
  "projectName": "上海项目",
  "lat": 31.2304,
  "lng": 121.4737,
  "address": "上海市",
  "circle": 500,
  "distanceUnit": "m",
  "localLat": 31.2304,
  "localLng": 121.4737,
  "microBind": null
}
```

响应：

```json
{
  "projectInfo": {
    "projectID": 1,
    "groupID": "group_xxx",
    "projectName": "上海项目"
  }
}
```

### 重命名项目

```text
POST group/project/name/update
```

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 1,
  "projectName": "新项目名"
}
```

响应：

```json
{}
```

### 更新项目

```text
POST group/project/update
```

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 1,
  "projectName": "上海项目",
  "lat": 31.2304,
  "lng": 121.4737,
  "address": "上海市",
  "circle": 500,
  "distanceUnit": "m",
  "removeAddress": false
}
```

响应：

```json
{}
```

### 删除项目

```text
POST group/project/delete
```

请求：

```json
{
  "groupID": "group_xxx",
  "groupName": "工程一队",
  "projectID": 1,
  "projectName": "上海项目"
}
```

响应：

```json
{}
```

### 项目统计

```text
POST group/project/statistics
```

`projectID = 0` 表示团队总览。

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 0
}
```

响应：

```json
{
  "statistics": {
    "overView": {
      "photoCount": 100
    },
    "contributors": [
      {
        "userID": "user_xxx",
        "userName": "Wayne",
        "shortName": "W",
        "avatar": "https://example.com/avatar.png",
        "photoCount": 30
      }
    ]
  }
}
```

### 项目成员列表

```text
POST group/project/user/list
```

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 1
}
```

响应：

```json
{
  "users": [
    {
      "userID": "user_xxx",
      "userName": "Wayne",
      "shortName": "W",
      "avatar": "https://example.com/avatar.png",
      "role": "普通成员",
      "roleID": 3,
      "accessControl": null
    }
  ]
}
```

### 添加项目成员

```text
POST group/project/user/add
```

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 1,
  "userIDs": ["user_1", "user_2"],
  "roleID": 3,
  "accessControl": {
    "photoAC": 31
  }
}
```

响应：

```json
{}
```

### 移除项目成员

```text
POST group/project/user/delete
```

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 1,
  "userIDs": ["user_1", "user_2"]
}
```

响应：

```json
{}
```

### 更新项目成员角色

```text
POST group/project/user/role/update
```

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 1,
  "userID": "user_xxx",
  "roleID": 3,
  "accessControl": {
    "photoAC": 31
  }
}
```

响应：

```json
{}
```

### 解绑 SharePoint

```text
POST web/teamspace/app/microsoft/unbind
```

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 1,
  "bindID": "bind_xxx"
}
```

响应：

```json
{}
```

## 8. 照片

### 照片列表

```text
POST photo/list/v1
```

请求：

```json
{
  "groupID": "group_xxx",
  "pageIndex": 1,
  "pageSize": 20,
  "rangeSelected": {
    "startTimeStamp": 1700000000000,
    "endTimeStamp": 1710000000000
  },
  "projectID": [1],
  "colleagueUserID": ["user_xxx"],
  "mediaType": [0],
  "topLeft": {
    "lat": 31.3,
    "lng": 121.4
  },
  "bottomRight": {
    "lat": 31.2,
    "lng": 121.5
  },
  "searchKey": "上海"
}
```

响应：

```json
{
  "totalCount": 1,
  "photos": [
    {
      "photoID": "photo_xxx",
      "mediaType": 0,
      "timestamp": 1710000000000,
      "duration": null,
      "largeURL": "https://example.com/photo.jpg",
      "smallURL": "https://example.com/photo-small.jpg",
      "userID": "user_xxx",
      "userName": "Wayne",
      "userShortName": "W",
      "userAvatar": "https://example.com/avatar.png",
      "projectID": null,
      "projectName": null,
      "antiFakeCode": "ABC123",
      "ossFileName": "photos/a.jpg",
      "localPhotoName": "IMG_0001.JPG",
      "location": "上海市",
      "lat": 31.2304,
      "lng": 121.4737
    }
  ],
  "contributors": [
    {
      "userID": "user_xxx",
      "_count": {
        "photoID": 1
      }
    }
  ]
}
```

`projectID` 为可选筛选条件。不传时返回团队下全部照片；照片可以不属于任何项目，此时返回的 `projectID`、`projectName` 为 `null`。

### 上传照片

```text
POST photo/upload
```

当前一期接口保存照片记录和 OSS 文件名。真实 COS 直传、签名 URL 或服务端代传可后续替换接入。

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 1,
  "ossFileName": "photos/2026/06/13/a.jpg",
  "takePhotoFormatTime": "2026-06-13 18:30:00",
  "takePhotoTimestamp": 1781346600000,
  "takePhotoTimezoneID": "Asia/Shanghai",
  "location": "上海市",
  "lat": 31.2304,
  "lng": 121.4737,
  "antiFakeCode": "ABC123",
  "watermarkID": "watermark_xxx",
  "watermarkBaseID": "base_xxx",
  "localPhotoName": "IMG_0001.JPG",
  "mediaType": 0,
  "saveToDevice": 1,
  "timeInfo": {
    "formatTime": "2026-06-13 18:30:00",
    "isOpen24HourTime": true,
    "isOpenTimeZone": true,
    "isOpenWeek": true,
    "timeStyle": "default",
    "timestamp": 1781346600000,
    "timezoneAbbreviation": "GMT+8",
    "timezoneID": "Asia/Shanghai"
  },
  "addressInfo": {
    "formatAddress": "上海市",
    "latlng": "31.2304,121.4737",
    "positionType": "gps"
  },
  "watermarkInfo": {
    "baseId": "base_xxx",
    "watermarkId": "watermark_xxx",
    "watermarkContent": []
  },
  "systemInfo": {
    "appLan": "zh-Hans",
    "countryCode": "CN",
    "deviceID": "device_xxx",
    "os": "iOS 18",
    "versionCode": "1.0.0",
    "deviceModel": "iPhone"
  },
  "mediaInfo": {
    "mediaID": "media_xxx",
    "imageWidth": 3024,
    "imageHeight": 4032,
    "imageUrl": "https://example.com/photo.jpg",
    "videoUrl": null,
    "duration": null,
    "fileSize": 1234567
  },
  "attendanceInfo": null
}
```

`projectID` 可选；不传、传 `null` 或传 `0` 时，照片只归属团队，不归属任何项目。传有效 `projectID` 时，服务端会校验该项目属于当前团队。

响应：

```json
{
  "photoID": "photo_xxx",
  "feedID": "feed_xxx"
}
```

说明：上传成功后，服务端会自动把同一用户、同一团队/项目、5 分钟内上传的照片归到同一条 `PHOTO` 类型 Feed，并返回该 `feedID`。

### 删除单张照片

```text
POST photo/delete
```

请求：

```json
{
  "groupID": "group_xxx",
  "photoID": "photo_xxx",
  "belongingProjectID": 1,
  "colleagueUserID": "user_xxx",
  "projectName": "上海项目"
}
```

响应：

```json
{}
```

说明：该接口为软删除，只会设置照片的 `deletedAt`，不会物理删除照片记录。

Feed 同步：删除后会把该照片从 `TeamFeedPhoto` 里解绑；如果原 Feed 已没有照片，会软删除该 Feed；如果仍有照片，会把 Feed 的兼容字段 `photoID/projectID` 更新为剩余照片的第一张。

### 批量删除照片

```text
POST photo/delete/batch/v1
```

请求：

```json
{
  "groupID": "group_xxx",
  "selectedPhotoIDs": ["photo_1", "photo_2"],
  "unSelectedPhotoIDs": [],
  "rangeSelected": false,
  "scene": "team"
}
```

响应：

```json
{
  "deletedCount": 2
}
```

说明：该接口为软删除，只会批量设置照片的 `deletedAt`，不会物理删除照片记录。

Feed 同步：批量删除后会把这些照片从对应 Feed 的照片组里解绑；空 Feed 会软删除，非空 Feed 会刷新首图兼容字段。

当 `rangeSelected = true` 时，表示按当前筛选条件全选，`unSelectedPhotoIDs` 表示排除项。

`scene` 可选：

- `team`：团队照片页批量操作。
- `project`：项目照片页批量操作，通常同时传 `projectID` 作为筛选条件。
- `user`：个人详情照片页批量操作，必须只操作当前登录用户自己的照片；可同时传 `colleagueUserID` 为当前用户 ID。

权限规则：

- 创建者、管理员：可以批量删除团队/项目内任意成员的照片。
- 普通成员：只能删除自己的照片；如果批量条件命中了其他人的照片，接口返回 `403`。
- 个人详情页：只支持删除当前登录用户自己的照片，即使是管理员也不能通过 `scene=user` 删除别人的个人详情照片。

### 移动照片

```text
POST photo/move/v1
```

请求：

```json
{
  "groupID": "group_xxx",
  "selectedPhotoIDs": ["photo_1", "photo_2"],
  "unSelectedPhotoIDs": [],
  "rangeSelected": false,
  "targetProjectID": 2,
  "scene": "project"
}
```

响应：

```json
{
  "movedCount": 2
}
```

`targetProjectID = 0` 表示将照片移出项目，仅保留团队归属。

批量移动同样支持 `scene=team/project/user`。创建者、管理员可移动团队/项目内任意成员的照片；普通成员只能移动自己的照片；个人详情页 `scene=user` 只支持移动当前登录用户自己的照片。传有效 `targetProjectID` 时，目标项目必须属于当前团队。

Feed 同步：移动后会先把照片从旧 Feed 解绑，再按照片上传者分组，在目标项目或团队级范围内创建新的 `PHOTO` Feed 并挂载这些照片。原 Feed 如果没有剩余照片会被软删除。

### 分享照片

```text
POST photo/share/v1
```

请求：

```json
{
  "groupID": "group_xxx",
  "selectedPhotoIDs": ["photo_1", "photo_2"],
  "unSelectedPhotoIDs": [],
  "keepUpdate": false,
  "willExpire": true,
  "rangeSelected": false,
  "fromPlace": "iOS",
  "shareEmails": ["a@example.com"],
  "customMsg": "请查看照片"
}
```

响应：

```json
{
  "url": "https://your-domain.com/share/share-key",
  "photoCount": 2,
  "successEmails": ["a@example.com"],
  "failEmails": [],
  "shareKey": "share-key"
}
```

### 打包下载

```text
POST photo/package
```

请求：

```json
{
  "groupID": "group_xxx",
  "timeZone": "Asia/Shanghai",
  "selectedPhotoIDs": ["photo_1", "photo_2"],
  "unSelectedPhotoIDs": [],
  "rangeSelected": false,
  "packageType": 1,
  "eventParams": {}
}
```

响应：

```json
{
  "taskID": "task_xxx"
}
```

当前一期会创建打包任务记录，真实异步压缩和下载 URL 后续接入。

### 打包状态

```text
POST photo/package/status
```

请求：

```json
{
  "groupID": "group_xxx",
  "taskID": "task_xxx",
  "packageType": 1
}
```

响应：

```json
{
  "packageStatus": 0,
  "url": null,
  "progress": 0,
  "title": null,
  "startTime": 1781346600000
}
```

### 取消打包

```text
POST photo/package/cancel
```

请求：

```json
{
  "groupID": "group_xxx",
  "taskID": "task_xxx",
  "packageType": 1
}
```

响应：

```json
{}
```

### 搜索照片

```text
POST photo/search
```

请求字段同 `photo/list/v1`，额外建议传 `searchKey`：

```json
{
  "groupID": "group_xxx",
  "pageIndex": 1,
  "pageSize": 20,
  "searchKey": "上海",
  "rangeSelected": {
    "startTimeStamp": 1700000000000,
    "endTimeStamp": 1710000000000
  }
}
```

响应同 `photo/list/v1`。

### 搜索推荐词

```text
POST photo/search/recommend
```

请求：

```json
{
  "groupID": "group_xxx"
}
```

响应：

```json
{
  "words": ["上海项目", "上海市", "ABC123"]
}
```

## 9. PDF 设置

### 查询 PDF 设置

```text
POST photo/pdf/setting
```

请求：

```json
{
  "groupID": "group_xxx"
}
```

响应：

```json
{
  "title": "照片报告",
  "icon": "https://example.com/icon.png",
  "iconOpen": true
}
```

### 更新 PDF 设置

```text
POST photo/pdf/setting/update
```

请求：

```json
{
  "groupID": "group_xxx",
  "title": "照片报告",
  "icon": "https://example.com/icon.png",
  "iconOpen": true
}
```

响应：

```json
{}
```

## 10. Feed 流 / 评论 / 点赞

### 表结构设计

`TeamFeed`：团队或项目首页动态。`groupID` 必填，`projectID` 可为空；为空表示团队级动态，非空表示项目动态。支持 `TEXT`、`PHOTO`、`SYSTEM` 三种类型，预留 `payload` JSON 承载扩展数据。

`TeamFeedPhoto`：Feed 和照片的关联表。一条 `TeamFeed` 可以对应多张照片。`TeamFeed.photoID` 仅保留为兼容字段，通常是第一张照片；客户端展示照片组时应优先使用返回里的 `photos` 数组。

照片上传后，服务端会自动把同一用户、同一团队/项目、默认 5 分钟内上传的照片归到同一条 `PHOTO` 类型 Feed。超过窗口会创建新的 Feed。时间窗口可在环境变量里修改：

```env
TEAM_FEED_AGGREGATION_MINUTES=5
```

也可以用毫秒精度覆盖：

```env
TEAM_FEED_AGGREGATION_MS=300000
```

聚合规则：

- 同一个用户。
- 同一个团队。
- 同一个项目；团队级照片只会和团队级照片聚合，项目照片只会和同一项目照片聚合。
- 在配置的上传时间窗口内。
- 同一条 Feed 追加新照片后会刷新 `updatedAt`，但 Feed 列表固定按 `createdAt` 倒序返回。

`TeamFeedComment`：动态评论。只支持新增和删除，不支持修改；删除为软删除。

`TeamFeedLike`：动态点赞。`feedID + userID` 唯一，防止重复点赞；取消点赞会删除点赞记录，用户之后可再次点赞。

权限规则：

1. 所有 feed、评论、点赞接口都需要登录，并且当前用户必须是该 `groupID` 的团队成员。
2. 带 `projectID` 时，项目必须属于当前团队且未删除。
3. 删除 feed：创建者本人、团队管理员、团队创建者可删除。
4. 删除评论：评论本人、团队管理员、团队创建者可删除。
5. 取消点赞：只取消当前用户自己的点赞。

### 获取 Feed 列表

```text
POST feed/list
```

请求：

```json
{
  "groupID": "group_xxx",
  "projectID": 123,
  "pageIndex": 1,
  "pageSize": 20
}
```

说明：

|参数|类型|必填|说明|
|---|---|---|---|
|`groupID`|string|否|团队 ID。查团队 feed 时传；如果只传 `projectID`，服务端会根据项目反查团队|
|`projectID`|number / null|否|传项目 ID 时只返回该项目动态；只传 `groupID` 或 `projectID=null` 时返回整个团队动态|
|`scope`|string|否|传 `teamOnly` 时只返回 `projectID=null` 的团队级动态|
|`pageIndex`|number|否|默认 1|
|`pageSize`|number|否|默认 20，最大 100|

查询规则：

- 团队 feed：传 `groupID`，不传 `projectID` 或传 `projectID=null`，返回团队下所有项目 Feed 和团队级 Feed。
- 项目 feed：传 `projectID`，可不传 `groupID`；服务端会校验该项目所属团队以及当前用户权限。
- 团队级 Feed：传 `groupID` 且 `scope=teamOnly`，只返回 `projectID=null` 的 Feed。
- 返回顺序：按 `createdAt` 倒序，即 Feed 生成时间越新的越靠前；评论、点赞、追加照片等更新不会改变列表排序。

响应：

```json
{
  "totalCount": 12,
  "pageIndex": 1,
  "pageSize": 20,
  "hasMore": false,
  "list": [
    {
      "feedID": "feed_xxx",
      "groupID": "group_xxx",
      "projectID": 123,
      "photoID": "photo_xxx",
      "photos": [
        {
          "photoID": "photo_xxx",
          "mediaType": 0,
          "timestamp": 1719200000000,
          "largeURL": "https://...",
          "smallURL": "https://...",
          "ossFileName": "teamspace/group_xxx/...",
          "localPhotoName": "IMG_001.jpg",
          "userID": "user_xxx",
          "userName": "Wayne",
          "userShortName": "WL",
          "userAvatar": "https://...",
          "projectID": 123,
          "projectName": "Project A",
          "location": "深圳市...",
          "lat": 22.543096,
          "lng": 114.057865
        }
      ],
      "feedType": "PHOTO",
      "title": "今日进展",
      "content": "现场照片已同步",
      "payload": {},
      "commentCount": 2,
      "likeCount": 3,
      "likedByMe": true,
      "createdAt": "2026-06-28T00:00:00.000Z",
      "updatedAt": "2026-06-28T00:00:00.000Z",
      "createdBy": {
        "userID": "user_xxx",
        "userName": "Wayne",
        "shortName": "WL",
        "email": "wayne@example.com",
        "avatar": "https://example.com/avatar.png"
      },
      "latestComments": []
    }
  ]
}
```

### 创建 Feed

```text
POST feed/create
```

请求：

```json
{
  "feedID": "feed_xxx",
  "groupID": "group_xxx",
  "projectID": 123,
  "feedType": "TEXT",
  "title": "今日进展",
  "content": "现场已完成打卡",
  "photoID": "photo_xxx",
  "photoIDs": ["photo_1", "photo_2"],
  "payload": {}
}
```

说明：`feedID` 可选；如果客户端传了 `feedID`，服务端创建时一定使用这个 `feedID`。重复传同一个已存在的 `feedID` 时，服务端直接返回已有动态。`projectID`、`title`、`content`、`photoID`、`photoIDs`、`payload` 都可按场景选择；但 `title/content/photoID/photoIDs/payload` 至少要传一个。`photoID/photoIDs` 如有传，照片必须属于当前团队；带 `projectID` 时照片也必须属于该项目。

响应：

```json
{
  "feedInfo": {}
}
```

### 删除 Feed

```text
POST feed/delete
```

请求：

```json
{
  "groupID": "group_xxx",
  "feedID": "feed_xxx"
}
```

响应：

```json
{}
```

### 新增评论

```text
POST feed/comment/create
```

请求：

```json
{
  "groupID": "group_xxx",
  "feedID": "feed_xxx",
  "projectID": 123,
  "photoID": "photo_xxx",
  "photoIDs": ["photo_1", "photo_2"],
  "feedType": "PHOTO",
  "feedTitle": "今日进展",
  "feedContent": "现场照片已同步",
  "feedPayload": {},
  "content": "收到"
}
```

说明：如果 `feedID` 不存在，服务端会自动创建一条 feed，然后再创建评论。自动创建 feed 时会使用请求中的 `projectID`、`photoID`、`photoIDs`、`feedType`、`feedTitle`、`feedContent`、`feedPayload`；这些字段可按场景传，不会把 `content` 评论内容当作 feed 内容。

响应：

```json
{
  "feedID": "feed_xxx",
  "feedCreated": true,
  "commentInfo": {
    "commentID": "comment_xxx",
    "feedID": "feed_xxx",
    "groupID": "group_xxx",
    "content": "收到",
    "createdAt": "2026-06-28T00:00:00.000Z",
    "user": {
      "userID": "user_xxx",
      "userName": "Wayne",
      "shortName": "WL",
      "email": "wayne@example.com",
      "avatar": "https://example.com/avatar.png"
    }
  }
}
```

### 删除评论

```text
POST feed/comment/delete
```

请求：

```json
{
  "groupID": "group_xxx",
  "commentID": "comment_xxx"
}
```

响应：

```json
{}
```

### 点赞

```text
POST feed/like/create
```

请求：

```json
{
  "groupID": "group_xxx",
  "feedID": "feed_xxx",
  "projectID": 123,
  "photoID": "photo_xxx",
  "photoIDs": ["photo_1", "photo_2"],
  "feedType": "PHOTO",
  "feedTitle": "今日进展",
  "feedContent": "现场照片已同步",
  "feedPayload": {}
}
```

说明：如果 `feedID` 不存在，服务端会自动创建一条 feed，然后再点赞。自动创建 feed 时同样使用 `projectID`、`photoID`、`photoIDs`、`feedType`、`feedTitle`、`feedContent`、`feedPayload`。

响应：

```json
{
  "feedID": "feed_xxx",
  "feedCreated": true,
  "likeID": "like_xxx",
  "liked": true,
  "alreadyLiked": false
}
```

### 取消点赞

```text
POST feed/like/delete
```

请求：

```json
{
  "groupID": "group_xxx",
  "feedID": "feed_xxx"
}
```

响应：

```json
{
  "liked": false,
  "deleted": true
}
```

## 11. iOS 端注意事项

1. 登录成功后保存 `token`，后续请求放到 `Authorization: Bearer <token>`。
2. 时间戳统一使用毫秒级 Unix timestamp。
3. 经纬度建议用 number 传递，服务端会按 decimal 存储。
4. `timeInfo`、`addressInfo`、`watermarkInfo`、`systemInfo`、`mediaInfo`、`attendanceInfo` 可以传 JSON 对象，也兼容 JSON 字符串。
5. 批量删除、移动、分享、打包都支持两种模式：传具体 `selectedPhotoIDs`，或 `rangeSelected=true` 后按筛选条件批量处理。
6. 当前一期上传接口保存 OSS 对象名和媒体 URL。若后续改成 COS 预签名上传，iOS 端上传流程会变成“先取上传凭证，再直传 COS，再调用 `photo/upload` 保存照片记录”。
