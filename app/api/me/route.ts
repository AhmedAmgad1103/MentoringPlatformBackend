import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { unauthorized } from "@/lib/api"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const assignedMentor = user.assignedMentorId
    ? await prisma.user.findUnique({
        where: { id: user.assignedMentorId },
        select: { id: true, name: true },
      })
    : null

  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    assignedMentor,
  })
}