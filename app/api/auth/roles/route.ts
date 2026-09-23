import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const email = url.searchParams.get("email")?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ roles: [] })
  }

  const users = await prisma.user.findMany({
    where: { email },
    select: { role: true, mentorStatus: true },
    orderBy: { role: "asc" },
  })

  return NextResponse.json({
    roles: users
      .filter((user) => user.role !== "MENTOR" || user.mentorStatus !== "PENDING")
      .map((user) => user.role),
    mentorPending: users.some((user) => user.role === "MENTOR" && user.mentorStatus === "PENDING"),
  })
}
