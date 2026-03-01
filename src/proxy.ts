import { NextResponse } from "next/server"
import { auth } from "@/auth"

// ─── 公開路由（不需認證） ───
const publicPaths = ["/", "/login"]

const publicPrefixes = [
  "/api/auth/", // Auth.js 路由
]

const publicExact = ["/api/health"]

// ─── 需要 admin 角色的路由 ───
const adminPrefixes = ["/admin", "/api/admin"]

// ─── 需要認證的路由 ───
const protectedPrefixes = [
  "/projects",
  "/settings",
  "/api/projects",
  "/api/cards",
  "/api/columns",
  "/api/users",
  "/api/notifications",
]

/**
 * 判斷是否為 API 路由
 */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/")
}

/**
 * 判斷路徑是否匹配公開路由
 */
function isPublicPath(pathname: string): boolean {
  if (publicPaths.includes(pathname)) return true
  if (publicExact.includes(pathname)) return true

  for (const prefix of publicPrefixes) {
    if (pathname.startsWith(prefix)) return true
  }

  return false
}

/**
 * 判斷路徑是否匹配 admin 路由
 */
function isAdminPath(pathname: string): boolean {
  for (const prefix of adminPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return true
  }
  return false
}

/**
 * 判斷路徑是否匹配需要認證的路由
 */
function isProtectedPath(pathname: string): boolean {
  for (const prefix of protectedPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return true
  }
  return false
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // ─── 1. 公開路由：直接放行 ───
  if (isPublicPath(pathname)) {
    // 已登入使用者存取 /login → redirect 到 /projects
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL("/projects", req.nextUrl))
    }
    return NextResponse.next()
  }

  // ─── 2. Admin 路由：需要認證 + admin 角色 ───
  if (isAdminPath(pathname)) {
    if (!session) {
      if (isApiRoute(pathname)) {
        return NextResponse.json({ error: "未登入" }, { status: 401 })
      }
      return NextResponse.redirect(new URL("/login", req.nextUrl))
    }

    // Edge Runtime 無法使用 pg 模組查 DB，只能依賴 JWT 中的 role
    const role = session.user?.role
    if (role !== "admin") {
      if (isApiRoute(pathname)) {
        return NextResponse.json({ error: "權限不足" }, { status: 403 })
      }
      return NextResponse.redirect(new URL("/projects", req.nextUrl))
    }

    return NextResponse.next()
  }

  // ─── 3. 需要認證的路由 ───
  if (isProtectedPath(pathname)) {
    if (!session) {
      if (isApiRoute(pathname)) {
        return NextResponse.json({ error: "未登入" }, { status: 401 })
      }
      return NextResponse.redirect(new URL("/login", req.nextUrl))
    }
    return NextResponse.next()
  }

  // ─── 4. 其他路由：放行 ───
  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js)$).*)",
  ],
}
