import { auth } from "@/auth"

export const proxy = auth((req) => {
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth")
  const isLoginPage = req.nextUrl.pathname === "/login"

  if (isAuthRoute || isLoginPage) return

  const isWriteMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/")

  if (isApiRoute && isWriteMethod && !req.auth) {
    return new Response(JSON.stringify({ error: "未登入" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
})

export const config = {
  matcher: ["/api/:path*", "/login"],
}
