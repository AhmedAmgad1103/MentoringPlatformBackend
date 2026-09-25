import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = String(body.email ?? "").trim().toLowerCase()
  const code = String(body.code ?? "").trim()

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Email and a 6-digit code are required." }, { status: 400 })
  }

  // Temporary development flow:
  // every 6-digit code is accepted until the real email provider is connected.
  return NextResponse.json({
    verified: true,
    email,
  })
}
