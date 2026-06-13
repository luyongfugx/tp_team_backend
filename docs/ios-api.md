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
3. `group/list` 获取团队列表。
4. 无团队时调用 `group/create` 创建团队。
5. 管理员或创建者调用 `group/project/create` 创建项目。
6. 成员拍照后调用 `photo/upload` 上传照片记录。
7. 调用 `photo/list/v1` 查看团队或项目照片。

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
  "avatar": "https://example.com/new-avatar.png"
}
```

响应：

```json
{}
```

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
  "loginType": 3,
  "inviteLinkWay": "LINK",
  "email": "user@example.com",
  "veriCode": "123456",
  "avatar": "https://example.com/avatar.png",
  "userName": "Wayne",
  "appInstanceID": "ios-device-instance-id"
}
```

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

仅创建者可删除。

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
      "projectID": 1,
      "projectName": "上海项目",
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
  "rangeSelected": false
}
```

响应：

```json
{
  "deletedCount": 2
}
```

当 `rangeSelected = true` 时，表示按当前筛选条件全选，`unSelectedPhotoIDs` 表示排除项。

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
  "targetProjectID": 2
}
```

响应：

```json
{
  "movedCount": 2
}
```

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

## 10. iOS 端注意事项

1. 登录成功后保存 `token`，后续请求放到 `Authorization: Bearer <token>`。
2. 时间戳统一使用毫秒级 Unix timestamp。
3. 经纬度建议用 number 传递，服务端会按 decimal 存储。
4. `timeInfo`、`addressInfo`、`watermarkInfo`、`systemInfo`、`mediaInfo`、`attendanceInfo` 可以传 JSON 对象，也兼容 JSON 字符串。
5. 批量删除、移动、分享、打包都支持两种模式：传具体 `selectedPhotoIDs`，或 `rangeSelected=true` 后按筛选条件批量处理。
6. 当前一期上传接口保存 OSS 对象名和媒体 URL。若后续改成 COS 预签名上传，iOS 端上传流程会变成“先取上传凭证，再直传 COS，再调用 `photo/upload` 保存照片记录”。
