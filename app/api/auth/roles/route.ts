import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { MentorStatus, Role } from "@prisma/client"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const email = url.searchParams.get("email")?.trim().toLowerCase()

  if (!email) return NextResponse.json({ roles: [], mentorPending: false })

  const users = await prisma.user.findMany({
    where: { email },
    select: { role: true, mentorStatus: true },
    orderBy: { role: "asc" },
  })

  const roles = users
    .filter((user) => user.role === Role.STUDENT || (user.role === Role.MENTOR && user.mentorStatus === MentorStatus.APPROVED))
    .map((user) => user.role)

  return NextResponse.json({
    roles: [...new Set(roles)],
    mentorPending: users.some(
      (user) => user.role === Role.MENTOR && user.mentorStatus === MentorStatus.PENDING
    ),
  })
}
