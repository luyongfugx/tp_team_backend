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

    const value = settingValueInput(body.value)
    const setting = await teamSetting().upsert({
      where: { groupID_name: { groupID, name } },
      update: { value },
      create: {
        groupID,
        name,
        value,
      },
    })

    return settingOk({ setting: settingPayload(setting) })
  } catch (err) {
    console.log("[app/group/setting/update] error:", err)
    return settingServerError()
  }
}
