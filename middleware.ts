import { NextRequest, NextResponse } from "next/server"

const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:8443"

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin")
  const response =
    request.method === "OPTIONS"
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next()

  if (origin === frontendOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization")
    response.headers.set("Vary", "Origin")
  }

  return response
}

export const config = {
  matcher: ["/api/:path*"],
}
