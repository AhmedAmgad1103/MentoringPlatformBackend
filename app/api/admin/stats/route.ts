import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { forbidden, unauthorized } from "@/lib/api"
import { Role, ReportStatus, ModerationStatus } from "@prisma/client"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  const [
    totalStudents,
    totalMentors,
    pendingMentors,
    totalQuestions,
    questionsAnswered,
    pendingModeration,
    reportedContent,
  ] = await Promise.all([
    prisma.user.count({ where: { role: Role.STUDENT } }),
    prisma.user.count({ where: { role: Role.MENTOR, OR: [{ mentorStatus: "NONE" }, { mentorStatus: "APPROVED" }] } }),
    prisma.user.count({ where: { role: Role.MENTOR, mentorStatus: "PENDING" } }),
    prisma.question.count(),
    prisma.question.count({ where: { answers: { some: {} } } }),
    prisma.question.count({ where: { moderationStatus: ModerationStatus.PENDING } }),
    prisma.questionReport.count({ where: { status: ReportStatus.PENDING } }),
  ])

  return Response.json({
    totalStudents,
    totalMentors,
    pendingMentors,
    totalQuestions,
    questionsAnswered,
    pendingModeration,
    reportedContent,
  })
}
