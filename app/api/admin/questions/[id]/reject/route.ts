import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { conflict, forbidden, notFound, unauthorized } from "@/lib/api"
import { ModerationStatus, Role } from "@prisma/client"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  const { id } = await params

  const question = await prisma.question.findUnique({
    where: { id },
    select: { id: true, moderationStatus: true },
  })

  if (!question) return notFound("Question not found")
  if (question.moderationStatus !== ModerationStatus.PENDING) {
    return conflict("Only pending questions can be rejected")
  }

  const updated = await prisma.question.update({
    where: { id },
    data: { moderationStatus: ModerationStatus.REJECTED },
    select: {
      id: true,
      moderationStatus: true,
      status: true,
    },
  })

  return Response.json({ item: updated })
}
