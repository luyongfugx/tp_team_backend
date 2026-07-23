import { readBody, requireTeamManager, requireUser } from "@/app/api/_utils/api"
import { isValidSettingName, normalizeSettingName, settingError, settingOk, settingPayload, settingServerError, settingValueInput, teamSetting } from "@/app/api/group/setting/_utils/team-setting"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return settingError("未授权或登录已过期", 401)

    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const name = normalizeSettingName(body.name)
    if (!isValidSettingName(name) || !Object.prototype.hasOwnProperty.call(body, "value")) return settingError()
    if (!(await requireTeamManager(groupID, user.id))) return settingError("无团队管理权限", 403)

    const existing = await teamSetting().findUnique({ where: { groupID_name: { groupID, name } } })
    if (existing) return settingError("设置已存在")

    const setting = await teamSetting().create({
      data: {
        groupID,
        name,
        value: settingValueInput(body.value),
      },
    })

    return settingOk({ setting: settingPayload(setting) })
  } catch (err) {
    console.log("[app/group/setting/create] error:", err)
    return settingServerError()
  }
}
