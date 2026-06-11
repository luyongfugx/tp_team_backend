import nodemailer from "nodemailer"

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

export async function sendVerificationEmail(email: string, code: string) {
  const transporter = getTransporter()

  // 未配置 SMTP 时，回退到控制台打印，方便开发调试
  if (!transporter) {
    console.log(`[v0] SMTP 未配置，验证码邮件未真实发送。收件人: ${email}，验证码: ${code}`)
    return
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  await transporter.sendMail({
    from,
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
  })
}
