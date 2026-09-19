import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { forbidden, unauthorized } from "@/lib/api"
import { Role } from "@prisma/client"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  const mentors = await prisma.user.findMany({
    where: { role: Role.MENTOR },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: {
        select: {
          assignedStudents: true,
          answers: true,
        },
      },
    },
  })

  return Response.json({
    items: mentors.map((mentor) => ({
      id: mentor.id,
      name: mentor.name,
      email: mentor.email,
      createdAt: mentor.createdAt,
      studentCount: mentor._count.assignedStudents,
      answerCount: mentor._count.answers,
    })),
  })
}
