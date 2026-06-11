import { NextResponse } from "next/server"
import { authenticate } from "@/lib/auth"

// 受保护接口示例：需在请求头携带 Authorization: Bearer <token>
// 每次访问都会刷新 token 的过期时间
export async function GET(req: Request) {
  const result = await authenticate(req)

  if (!result) {
    return NextResponse.json({ error: "未授权或登录已过期" }, { status: 401 })
  }

  return NextResponse.json({
    user: { id: result.user.id, email: result.user.email },
    // 返回刷新后的最新过期时间
    expiresAt: result.expiresAt.toISOString(),
  })
}
