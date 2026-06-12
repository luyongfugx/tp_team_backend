import { NextResponse } from "next/server"
import { authenticate } from "@/lib/auth"
import type { User } from "@prisma/client"

// 鉴权成功后传给业务 handler 的上下文
export type AuthContext = {
  user: User
  expiresAt: Date
  // 动态路由参数（如 /api/posts/[id]）
  params?: Record<string, string | string[]>
}

type AuthedHandler = (req: Request, ctx: AuthContext) => Promise<Response> | Response

// 高阶包装器：统一校验 Bearer token、刷新过期时间，并把 user 注入 handler。
// 用法：export const GET = withAuth(async (req, { user, expiresAt }) => { ... })
export function withAuth(handler: AuthedHandler) {
  return async (req: Request, routeCtx?: { params?: Promise<Record<string, string | string[]>> }) => {
    const result = await authenticate(req)

    if (!result) {
      return NextResponse.json({ error: "未授权或登录已过期" }, { status: 401 })
    }

    // Next.js 15+ 动态路由 params 是 Promise，需 await
    const params = routeCtx?.params ? await routeCtx.params : undefined

    return handler(req, {
      user: result.user,
      expiresAt: result.expiresAt,
      params,
    })
  }
}
