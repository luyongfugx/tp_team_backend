import nodemailer from "nodemailer"
import path from "path"

type SendMailResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  messageId?: string
}

type MailAttachment = {
  filename: string
  path: string
  cid: string
  contentType?: string
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

function inviteLink(inviteCode: string) {
  const url = new URL("https://share.timeprint.net/invite")
  url.searchParams.set("code", inviteCode)
  return url.toString()
}

function verificationLoginLink(code: string) {
  const url = new URL("https://www.timeprint.net/login")
  url.searchParams.set("code", code)
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
  attachments,
}: {
  to: string
  subject: string
  text: string
  html: string
  scene: string
  attachments?: MailAttachment[]
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
    const info = await transporter.sendMail({ from, to, subject, text, html, attachments })
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
  const escapedCode = escapeHtml(code)
  const loginLink = verificationLoginLink(code)

  return sendLoggedMail({
    to: email,
    subject: "Timeprint Verification Code",
    text: `Your Timeprint verification code is ${code}. This code is valid for the next 5 minutes and can only be used once. Login now: ${loginLink}`,
    html: `
      <div style="margin: 0; padding: 0; background: #f6f7f9;">
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 18px;">
          <div style="background: #ffffff; border: 1px solid #edf0f3; border-radius: 18px; padding: 36px 32px; box-shadow: 0 12px 36px rgba(15, 23, 42, 0.06);">
            <img src="cid:timeprint-app-icon" width="60" height="60" alt="Timeprint" style="display: block; width: 60px; height: 60px; border-radius: 14px; margin: 0 0 34px;" />
            <div style="font-size: 48px; line-height: 1; font-weight: 800; letter-spacing: 8px; color: #050505; margin: 0 0 24px;">
              ${escapedCode}
            </div>
            <p style="color: #111827; font-size: 20px; line-height: 1.5; margin: 0 0 18px;">
              This code is valid for the next 5 minutes and can only be used once.
            </p>
            <p style="color: #111827; font-size: 20px; line-height: 1.5; margin: 0 0 28px;">
              If you didn't request this code, please ignore this email.
            </p>
            <a href="${loginLink}" style="display: inline-block; background: #ffe700; color: #111111; text-decoration: none; font-size: 17px; font-weight: 700; padding: 13px 22px; border-radius: 10px;">
              现在登录
            </a>
            <p style="color: #111827; font-size: 20px; line-height: 1.5; margin: 34px 0 0;">
              The Timeprint Team<br />
              <a href="https://timeprint.net" style="color: #1683d8; text-decoration: none;">timeprint.net</a>
            </p>
          </div>
          <div style="color: #9ca3af; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 28px;">
            © Timeprint 2026<br />
            <a href="https://timeprint.net/privacy" style="color: #9ca3af; text-decoration: none;">Privacy</a>
            <span style="padding: 0 12px;">|</span>
            <a href="https://timeprint.net/terms" style="color: #9ca3af; text-decoration: none;">Terms</a>
          </div>
        </div>
      </div>
    `,
    scene: "verification",
    attachments: [
      {
        filename: "timeprint-mail-icon.png",
        path: path.join(process.cwd(), "public", "timeprint-mail-icon.png"),
        cid: "timeprint-app-icon",
        contentType: "image/png",
      },
    ],
  })
}

export async function sendTeamInviteEmail({
  email,
  groupName,
  inviterName,
  inviteCode,
  memberCount,
  photoCount,
}: {
  email: string
  groupName: string
  inviterName: string
  inviteCode: string
  memberCount: number
  photoCount: number
}) {
  const link = inviteLink(inviteCode)
  const escapedGroupName = escapeHtml(groupName)
  const escapedInviterName = escapeHtml(inviterName)
  const inviterInitial = escapeHtml((inviterName.trim()[0] || "T").toUpperCase())
  const content = `${inviterName} invited you to join ${groupName}. Accept now: ${link}`

  return sendLoggedMail({
    to: email,
    subject: `${inviterName} invited you to join ${groupName}`,
    text: content,
    html: `
      <div style="margin: 0; padding: 0; background: #f6f7f9;">
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 18px;">
          <div style="background: #ffffff; border: 1px solid #edf0f3; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 36px rgba(15, 23, 42, 0.06);">
            <div style="padding: 34px 32px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 0 0 36px;">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="cid:timeprint-app-icon" width="56" height="56" alt="Timeprint" style="display: block; width: 56px; height: 56px; border-radius: 14px;" />
                  </td>
                  <td style="vertical-align: middle; padding-left: 22px; color: #111827; font-size: 30px; font-weight: 500;">
                    Timeprint
                  </td>
                </tr>
              </table>
              <div style="width: 88px; height: 88px; border-radius: 50%; background: #405768; color: #ffffff; font-size: 44px; line-height: 88px; text-align: center; margin: 0 0 34px;">
                ${inviterInitial}
              </div>
              <div style="color: #111827; font-size: 32px; line-height: 1.28; font-weight: 800; margin: 0 0 30px;">
                ${escapedInviterName} invited you to join ${escapedGroupName}
              </div>
              <p style="color: #5f6368; font-size: 21px; line-height: 1.5; margin: 0 0 34px;">
                Collect and organize work photos automatically with Timeprint teamspace
              </p>
              <a href="${link}" style="display: block; background: #1f456d; color: #ffffff; text-decoration: none; text-align: center; font-size: 21px; font-weight: 700; padding: 17px 22px; border-radius: 10px;">
                Accept Now
              </a>
            </div>
            <div style="background: #edf6ff; padding: 26px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                <tr>
                  <td style="width: 58px; vertical-align: middle;">
                    <div style="width: 50px; height: 50px; border-radius: 10px; background: #ffffff; color: #1f456d; font-size: 18px; font-weight: 800; line-height: 50px; text-align: center;">TM</div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 14px;">
                    <div style="color: #111827; font-size: 24px; font-weight: 800; line-height: 1.25;">${escapedGroupName}</div>
                    <div style="color: #374151; font-size: 17px; line-height: 1.5;">${memberCount} members · ${photoCount} photos</div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        </div>
      </div>
    `,
    scene: "team-invite",
    attachments: [
      {
        filename: "timeprint-mail-icon.png",
        path: path.join(process.cwd(), "public", "timeprint-mail-icon.png"),
        cid: "timeprint-app-icon",
        contentType: "image/png",
      },
    ],
  })
}
