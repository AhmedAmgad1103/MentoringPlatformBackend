import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "@/lib/api"
import { detailSelect, toQuestionDTO, visibleWhere } from "@/lib/questions"
import { QuestionStatus, Role } from "@prisma/client"

const allowedStatusChanges = [QuestionStatus.CLOSED, QuestionStatus.AWAITING_RESPONSE]

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { id } = await params

  const question = await prisma.question.findFirst({
    where: { AND: [{ id }, visibleWhere(user)] },
    select: detailSelect(user.id),
  })

  if (!question) return notFound("Question not found")

  const { answers, ...rest } = question
  return Response.json({
    ...toQuestionDTO(rest, user),
    answers: answers.map(({ helpfulVotes, ...answer }) => ({
      ...answer,
      helpfulCount: helpfulVotes.length,
      helpfulByMe: helpfulVotes.some((vote) => vote.userId === user.id),
    })),
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { id } = await params

  const question = await prisma.question.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      mentorId: true,
      status: true,
      visibility: true,
      moderationStatus: true,
    },
  })

  if (!question) return notFound("Question not found")

  if (user.role !== Role.ADMIN && question.studentId !== user.id) {
    return forbidden("Only the question owner or an admin can change question status")
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be valid JSON")
  }

  const nextStatus = body.status
  if (
    typeof nextStatus !== "string" ||
    !allowedStatusChanges.includes(nextStatus as QuestionStatus)
  ) {
    return badRequest("status must be CLOSED or AWAITING_RESPONSE")
  }

  if (
    question.moderationStatus === "REJECTED" ||
    (question.visibility === "PUBLIC" && question.moderationStatus === "PENDING")
  ) {
    return conflict("This question cannot be reopened or changed while moderation is unresolved")
  }

  if (nextStatus === question.status) {
    return Response.json({
      item: {
        id: question.id,
        status: question.status,
      },
    })
  }

  if (
    nextStatus === QuestionStatus.AWAITING_RESPONSE &&
    question.status !== QuestionStatus.CLOSED
  ) {
    return conflict("Only closed questions can be reopened")
  }

  const updated = await prisma.question.update({
    where: { id },
    data: { status: nextStatus as QuestionStatus },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  })

  return Response.json({ item: updated })
}
