import { asStringArray, readBody, requireTeamMember, requireUser } from "@/app/api/_utils/api"
import { isValidSettingName, normalizeSettingName, settingError, settingOk, settingPayloads, settingServerError, teamSetting } from "@/app/api/group/setting/_utils/team-setting"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return settingError("未授权或登录已过期", 401)

    const body = await readBody(req)
    const groupID = typeof body.groupID === "string" ? body.groupID : ""
    if (!(await requireTeamMember(groupID, user.id))) return settingError("无团队访问权限", 403)

    const names = [...new Set(asStringArray(body.names).map(normalizeSettingName).filter(isValidSettingName))]
    const settings = await teamSetting().findMany({
      where: {
        groupID,
        ...(names.length > 0 ? { name: { in: names } } : {}),
      },
      orderBy: { name: "asc" },
    })

    return settingOk({ settings: settingPayloads(settings) })
  } catch (err) {
    console.log("[app/group/setting/list] error:", err)
    return settingServerError()
  }
}
