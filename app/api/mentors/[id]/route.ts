import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { notFound, unauthorized } from "@/lib/api"
import { Role } from "@prisma/client"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { id } = await params

  const mentor = await prisma.user.findFirst({
    where: {
      id,
      role: Role.MENTOR,
    },
    select: {
      id: true,
      name: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          assignedStudents: true,
          answers: true,
        },
      },
    },
  })

  if (!mentor) return notFound("Mentor not found")

  return Response.json({
    id: mentor.id,
    name: mentor.name,
    role: mentor.role,
    createdAt: mentor.createdAt,
    studentCount: mentor._count.assignedStudents,
    answerCount: mentor._count.answers,
    isMyMentor: mentor.id === user.assignedMentorId,
  })
}
