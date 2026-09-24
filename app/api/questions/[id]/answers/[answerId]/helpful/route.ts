import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import {
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "@/lib/api"
import { visibleWhere } from "@/lib/questions"
import { Role, Prisma } from "@prisma/client"
import { setHelpfulVoteReward } from "@/lib/rewards"

async function getAnswer(answerId: string, user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return null

  return prisma.answer.findFirst({
    where: {
      id: answerId,
      question: visibleWhere(user),
    },
    select: {
      id: true,
      mentorId: true,
      questionId: true,
    },
  })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; answerId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.STUDENT) {
    return forbidden("Only students can mark answers helpful")
  }

  const { id, answerId } = await params
  const answer = await getAnswer(answerId, user)
  if (!answer || answer.questionId !== id) return notFound("Answer not found")

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.answerHelpfulVote.create({
        data: { answerId, userId: user.id },
      })

      await setHelpfulVoteReward(tx, {
        mentorId: answer.mentorId,
        answerId,
        voterId: user.id,
        active: true,
      })

      const helpfulCount = await tx.answerHelpfulVote.count({
        where: { answerId },
      })

      return { helpfulCount }
    })

    return Response.json(
      { helpful: true, helpfulCount: result.helpfulCount },
      { status: 201 }
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflict("Answer already marked helpful")
    }
    throw error
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; answerId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.STUDENT) {
    return forbidden("Only students can remove helpful votes")
  }

  const { id, answerId } = await params
  const answer = await getAnswer(answerId, user)
  if (!answer || answer.questionId !== id) return notFound("Answer not found")

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.answerHelpfulVote.deleteMany({
      where: { answerId, userId: user.id },
    })

    if (deleted.count === 0) {
      return null
    }

    await setHelpfulVoteReward(tx, {
      mentorId: answer.mentorId,
      answerId,
      voterId: user.id,
      active: false,
    })

    const helpfulCount = await tx.answerHelpfulVote.count({
      where: { answerId },
    })

    return { helpfulCount }
  })

  if (!result) return conflict("Answer is not marked helpful")

  return Response.json({
    helpful: false,
    helpfulCount: result.helpfulCount,
  })
}
