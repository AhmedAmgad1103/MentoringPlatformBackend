import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = String(body.email ?? "").trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 },
    )
  }

  // Temporary development flow:
  // no email is sent yet. The real email provider can be connected later.
  return NextResponse.json({
    sent: false,
    development: true,
    expiresInSeconds: 600,
  })
}
