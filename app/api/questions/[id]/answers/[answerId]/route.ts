import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api"
import { Role } from "@prisma/client"

const CONTENT_MAX = 5000

const answerSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  questionId: true,
  mentorId: true,
  mentor: {
    select: {
      id: true,
      name: true,
    },
  },
} as const

async function getOwnedAnswer(answerId: string, mentorId: string) {
  return prisma.answer.findFirst({
    where: {
      id: answerId,
      mentorId,
    },
    select: answerSelect,
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; answerId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.MENTOR) {
    return forbidden("Only mentors can edit answers")
  }

  const { id, answerId } = await params
  const answer = await getOwnedAnswer(answerId, user.id)

  if (!answer || answer.questionId !== id) {
    return notFound("Answer not found")
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be valid JSON")
  }

  const content = typeof body.content === "string" ? body.content.trim() : ""
  if (!content) return badRequest("content is required")
  if (content.length > CONTENT_MAX) {
    return badRequest("content must be at most 5000 characters")
  }

  const updated = await prisma.answer.update({
    where: { id: answerId },
    data: { content },
    select: answerSelect,
  })

  return Response.json({ item: updated })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; answerId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.MENTOR) {
    return forbidden("Only mentors can delete answers")
  }

  const { id, answerId } = await params
  const answer = await getOwnedAnswer(answerId, user.id)

  if (!answer || answer.questionId !== id) {
    return notFound("Answer not found")
  }

  await prisma.answer.delete({
    where: { id: answerId },
  })

  const remainingAnswers = await prisma.answer.count({
    where: { questionId: id },
  })

  return Response.json({
    deleted: true,
    questionHasAnswers: remainingAnswers > 0,
  })
}
