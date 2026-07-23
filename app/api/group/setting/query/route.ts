import { readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { isValidSettingName, normalizeSettingName, settingError, settingOk, settingPayload, settingServerError, teamSetting } from "@/app/api/group/setting/_utils/team-setting"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return settingError("未授权或登录已过期", 401)

    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    const name = normalizeSettingName(body.name)
    if (!isValidSettingName(name)) return settingError()
    if (!(await requireTeamMember(groupID, user.id))) return settingError("无团队访问权限", 403)

    const setting = await teamSetting().findUnique({
      where: { groupID_name: { groupID, name } },
    })
    if (!setting) return settingError("设置不存在", 404)

    return settingOk({ setting: settingPayload(setting) })
  } catch (err) {
    console.log("[app/group/setting/query] error:", err)
    return settingServerError()
  }
}
