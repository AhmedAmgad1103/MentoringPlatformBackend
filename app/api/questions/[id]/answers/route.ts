import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { canMentorAnswerQuestion, canViewQuestion } from "@/lib/authz"
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api"
import { QuestionStatus } from "@prisma/client"

const CONTENT_MAX = 5000

const answerSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  mentor: {
    select: {
      id: true,
      name: true,
    },
  },
} as const

export async function GET(
  _request: Request,
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
      visibility: true,
      moderationStatus: true,
    },
  })

  if (!question || !canViewQuestion(user, question)) {
    return notFound("Question not found")
  }

  const answers = await prisma.answer.findMany({
    where: { questionId: id },
    orderBy: { createdAt: "asc" },
    select: answerSelect,
  })

  return Response.json({ items: answers })
}

export async function POST(
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
      mentorId: true,
      visibility: true,
      moderationStatus: true,
      status: true,
    },
  })

  if (!question) return notFound("Question not found")
  if (!canMentorAnswerQuestion(user, question)) {
    return forbidden("You are not allowed to answer this question")
  }
  if (question.status === QuestionStatus.CLOSED) {
    return forbidden("This question is closed")
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

  const answer = await prisma.$transaction(async (tx) => {
    const created = await tx.answer.create({
      data: {
        content,
        questionId: id,
        mentorId: user.id,
      },
      select: answerSelect,
    })

    await tx.question.updateMany({
      where: {
        id,
        status: QuestionStatus.AWAITING_RESPONSE,
      },
      data: {
        status: QuestionStatus.ANSWERED,
      },
    })

    return created
  })

  const updatedQuestion = await prisma.question.findUnique({
    where: { id },
    select: { status: true },
  })

  return Response.json(
    {
      item: answer,
      questionStatus: updatedQuestion?.status ?? QuestionStatus.ANSWERED,
    },
    { status: 201 }
  )
}
