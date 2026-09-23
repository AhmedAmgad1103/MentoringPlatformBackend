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
    select: { role: true },
    orderBy: { role: "asc" },
  })

  return NextResponse.json({
    roles: users.map((user) => user.role),
  })
}
