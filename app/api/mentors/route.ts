import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { unauthorized } from "@/lib/api"
import { Role } from "@prisma/client"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const mentors = await prisma.user.findMany({
    where: { role: Role.MENTOR },
    orderBy: { name: "asc" },
    select: { id: true, name: true, avatarUrl: true },
  })

  return Response.json(
    mentors.map((m) => ({
      ...m,
      isMyMentor: m.id === user.assignedMentorId,
    }))
  )
}