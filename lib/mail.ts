import nodemailer from "nodemailer"

type SendMailResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  messageId?: string
}

// SMTP 配置从环境变量读取
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    return null
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 使用 SSL，其他端口使用 STARTTLS
    auth: { user, pass },
  })
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return String(err)
}

function inviteLink(groupID: string, uuID: string) {
  const baseURL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || ""
  if (!baseURL) return ""
  const url = new URL("/invite", baseURL)
  url.searchParams.set("groupID", groupID)
  url.searchParams.set("uuID", uuID)
  url.searchParams.set("inviteLinkWay", "EMAIL")
  return url.toString()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function sendLoggedMail({
  to,
  subject,
  text,
  html,
  scene,
}: {
  to: string
  subject: string
  text: string
  html: string
  scene: string
}): Promise<SendMailResult> {
  const transporter = getTransporter()
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT || "465"
  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  if (!transporter) {
    const reason = "SMTP 未配置，邮件未真实发送"
    console.warn(`[mail:${scene}] ${reason}`, { to, subject })
    return { ok: false, skipped: true, reason }
  }

  console.log(`[mail:${scene}] 开始发送邮件`, { to, subject, from, host, port })

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html })
    console.log(`[mail:${scene}] 邮件发送成功`, {
      to,
      subject,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    const reason = errorMessage(err)
    console.error(`[mail:${scene}] 邮件发送失败`, { to, subject, reason, err })
    return { ok: false, reason }
  }
}

export async function sendVerificationEmail(email: string, code: string) {
  return sendLoggedMail({
    to: email,
    subject: "您的登录验证码",
    text: `您的登录验证码是 ${code}，5 分钟内有效。如非本人操作请忽略此邮件。`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111;">登录验证码</h2>
        <p style="color: #555; font-size: 14px;">您正在登录，请使用以下验证码完成验证：</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111; background: #f4f4f5; padding: 16px; text-align: center; border-radius: 8px; margin: 24px 0;">
          ${code}
        </div>
        <p style="color: #999; font-size: 12px;">验证码 5 分钟内有效。如非本人操作，请忽略此邮件。</p>
      </div>
    `,
    scene: "verification",
  })
}

export async function sendTeamInviteEmail({
  email,
  groupID,
  groupName,
  uuID,
  expiresAt,
}: {
  email: string
  groupID: string
  groupName: string
  uuID: string
  expiresAt: Date
}) {
  const link = inviteLink(groupID, uuID)
  const escapedGroupName = escapeHtml(groupName)
  const inviteText = link
    ? `请点击以下链接加入团队：${link}`
    : `请在 App 内使用以下邀请信息加入团队：groupID=${groupID}，uuID=${uuID}`

  return sendLoggedMail({
    to: email,
    subject: `邀请你加入团队 ${groupName}`,
    text: `你收到一个团队邀请。\n\n团队：${groupName}\n${inviteText}\n\n邀请 7 天内有效，过期时间：${expiresAt.toISOString()}。`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111;">邀请你加入团队</h2>
        <p style="color: #555; font-size: 14px;">你收到一个团队邀请：</p>
        <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #111; font-size: 16px; font-weight: 600;">${escapedGroupName}</p>
        </div>
        ${
          link
            ? `<p><a href="${link}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 6px;">加入团队</a></p>`
            : `<p style="color: #555; font-size: 14px;">请在 App 内使用邀请信息加入团队。</p>`
        }
        <p style="color: #999; font-size: 12px;">邀请 7 天内有效，过期时间：${expiresAt.toISOString()}。</p>
      </div>
    `,
    scene: "team-invite",
  })
}
