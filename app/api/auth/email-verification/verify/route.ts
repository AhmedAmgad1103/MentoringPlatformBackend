import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { prisma } from "@/lib/prisma"

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex")
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = String(body.email ?? "").trim().toLowerCase()
  const code = String(body.code ?? "").trim()

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Email and a 6-digit code are required." }, { status: 400 })
  }

  const verification = await prisma.emailVerification.findFirst({
    where: {
      email,
      codeHash: hashCode(code),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!verification) {
    return NextResponse.json({ error: "That code is invalid or has expired." }, { status: 400 })
  }

  await prisma.emailVerification.update({
    where: { id: verification.id },
    data: { usedAt: new Date() },
  })

  return NextResponse.json({
    verified: true,
    email,
  })
}
