import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { Role } from "@prisma/client"
import { notFound, unauthorized } from "@/lib/api"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  if (user.role !== Role.STUDENT) {
    return notFound("Assigned mentor not found")
  }

  if (!user.assignedMentorId) {
    return Response.json({ mentor: null })
  }

  const mentor = await prisma.user.findFirst({
    where: {
      id: user.assignedMentorId,
      role: Role.MENTOR,
    },
    select: {
      id: true,
      name: true,
      email: true,
      mentorStatus: true,
      _count: {
        select: {
          answers: true,
          assignedStudents: true,
        },
      },
    },
  })

  if (!mentor) {
    return Response.json({ mentor: null })
  }

  return Response.json({
    mentor: {
      id: mentor.id,
      name: mentor.name,
      email: mentor.email,
      mentorStatus: mentor.mentorStatus,
      answerCount: mentor._count.answers,
      studentCount: mentor._count.assignedStudents,
    },
  })
}
