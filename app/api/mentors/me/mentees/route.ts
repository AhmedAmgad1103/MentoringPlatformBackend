import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { forbidden, unauthorized } from "@/lib/api"
import { Role } from "@prisma/client"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.MENTOR) {
    return forbidden("Only mentors can view assigned mentees")
  }

  const items = await prisma.user.findMany({
    where: {
      role: Role.STUDENT,
      assignedMentorId: user.id,
    },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: {
        select: {
          questions: true,
        },
      },
    },
  })

  return Response.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      createdAt: item.createdAt,
      questionCount: item._count.questions,
    })),
  })
}
