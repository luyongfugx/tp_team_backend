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
      "avatar": "https://example.com/avatar.png"
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

### 退出团队

```text
POST group/user/exit
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

创建者不能直接退出，需要先调用团队转让接口。

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

请求：

```json
{
  "groupID": "group_xxx",
  "deletedUserIDs": ["user_1", "user_2"]
}
```

响应：

```json
{}
```

### 更新成员角色

```text
POST group/user/role/update
```

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
{}
```

仅创建者可操作。转让创建者请使用 `group/transfer`。

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
  "expiredDays": 7,
  "succeedSendEmails": ["a@example.com"],
  "failedSendEmails": [],
  "invalidEmails": [],
  "alreadyMemberEmails": ["b@example.com"]
}
```

邮件内容里的加入链接格式：

```text
https://share.timeprint.net/invite?code=123456
```

其中 `code` 为 6 位数字邀请码。

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
  "photoID": "photo_xxx"
}
```

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
|`groupID`|string|是|团队 ID|
|`projectID`|number / null|否|传项目 ID 时只返回该项目动态；不传或传 `null` 时返回整个团队动态|
|`scope`|string|否|传 `teamOnly` 时只返回 `projectID=null` 的团队级动态|
|`pageIndex`|number|否|默认 1|
|`pageSize`|number|否|默认 20，最大 100|

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
  "payload": {}
}
```

说明：`feedID` 可选；如果客户端传了 `feedID`，服务端创建时一定使用这个 `feedID`。重复传同一个已存在的 `feedID` 时，服务端直接返回已有动态。`projectID`、`title`、`content`、`photoID`、`payload` 都可按场景选择；但 `title/content/photoID/payload` 至少要传一个。`photoID` 如有传，照片必须属于当前团队；带 `projectID` 时照片也必须属于该项目。

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
  "feedType": "PHOTO",
  "feedTitle": "今日进展",
  "feedContent": "现场照片已同步",
  "feedPayload": {},
  "content": "收到"
}
```

说明：如果 `feedID` 不存在，服务端会自动创建一条 feed，然后再创建评论。自动创建 feed 时会使用请求中的 `projectID`、`photoID`、`feedType`、`feedTitle`、`feedContent`、`feedPayload`；这些字段可按场景传，不会把 `content` 评论内容当作 feed 内容。

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
  "feedType": "PHOTO",
  "feedTitle": "今日进展",
  "feedContent": "现场照片已同步",
  "feedPayload": {}
}
```

说明：如果 `feedID` 不存在，服务端会自动创建一条 feed，然后再点赞。自动创建 feed 时同样使用 `projectID`、`photoID`、`feedType`、`feedTitle`、`feedContent`、`feedPayload`。

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
