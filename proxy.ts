import { NextResponse, type NextRequest } from "next/server"

// 需要鉴权的路由前缀
const PROTECTED_PREFIXES = ["/api/me"]

// 公开的鉴权相关路由（永远放行）
const PUBLIC_API = ["/api/auth/send-code", "/api/auth/verify-code"]

// 边缘层中间件（运行在 Edge runtime，无法访问数据库）。
// 这里只做轻量预检：受保护路由若没带 Bearer token，直接 401 拦掉，
// 不让请求进入路由处理。真正的 token 校验与过期刷新在 withAuth 里完成（Node runtime + Prisma）。
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 公开路由放行
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  if (!isProtected) {
    return NextResponse.next()
  }

  const auth = req.headers.get("authorization")
  const hasBearer = auth?.toLowerCase().startsWith("bearer ") && auth.split(" ")[1]

  if (!hasBearer) {
    return NextResponse.json({ error: "缺少认证 token" }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  // 只匹配 /api 路由
  matcher: ["/api/:path*"],
}
