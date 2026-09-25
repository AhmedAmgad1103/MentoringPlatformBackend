import { NextResponse } from "next/server"
import { createHash, randomInt } from "node:crypto"
import { prisma } from "@/lib/prisma"

const CODE_TTL_MS = 10 * 60 * 1000

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex")
}

async function sendVerificationEmail(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[MedMentor] Email verification code for ${email}: ${code}`)
      return { sent: false, development: true }
    }
    throw new Error("Email delivery is not configured.")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your MedMentor verification code",
      text: `Your MedMentor verification code is ${code}. It expires in 10 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#252342">
          <h2>Verify your MedMentor email</h2>
          <p>Use the code below to verify your school email address.</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:10px;margin:28px 0">${code}</div>
          <p style="color:#6d6885">This code expires in 10 minutes.</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || "Unable to send verification email.")
  }

  return { sent: true, development: false }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const email = String(body.email ?? "").trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.edu$/i.test(email)) {
    return NextResponse.json(
      { error: "A valid medical school .edu email is required." },
      { status: 400 },
    )
  }

  const recent = await prisma.emailVerification.findFirst({
    where: {
      email,
      createdAt: { gt: new Date(Date.now() - 30_000) },
      usedAt: null,
    },
    orderBy: { createdAt: "desc" },
  })

  if (recent) {
    return NextResponse.json(
      { error: "Please wait a few seconds before requesting another code." },
      { status: 429 },
    )
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0")

  await prisma.emailVerification.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.emailVerification.create({
    data: {
      email,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  })

  try {
    const delivery = await sendVerificationEmail(email, code)
    return NextResponse.json({
      sent: delivery.sent,
      expiresInSeconds: CODE_TTL_MS / 1000,
      ...(delivery.development ? { development: true } : {}),
    })
  } catch (error) {
    await prisma.emailVerification.updateMany({
      where: { email, codeHash: hashCode(code), usedAt: null },
      data: { usedAt: new Date() },
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send verification email." },
      { status: 503 },
    )
  }
}
