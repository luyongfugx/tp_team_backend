import { NextResponse } from "next/server"
import { withAuth } from "@/lib/with-auth"

// 受保护接口示例：鉴权由 withAuth 统一处理。
// proxy.ts 在边缘层预检 Bearer token；withAuth 校验 token 并刷新过期时间，再注入 user。
export const GET = withAuth(async (_req, { user, expiresAt }) => {
  return NextResponse.json({
    user: { id: user.id, email: user.email },
    // 返回刷新后的最新过期时间
    expiresAt: expiresAt.toISOString(),
  })
})
