import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import {
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "@/lib/api"
import { Prisma, Role } from "@prisma/client"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.STUDENT) {
    return forbidden("Only students can boost questions")
  }

  const { id } = await params

  const question = await prisma.question.findFirst({
    where: {
      id,
      OR: [
        { studentId: user.id },
        {
          visibility: "PUBLIC",
          moderationStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
        },
      ],
    },
    select: { id: true },
  })

  if (!question) return notFound("Question not found")

  try {
    await prisma.questionBoost.create({
      data: { questionId: id, userId: user.id },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflict("Question already boosted")
    }
    throw error
  }

  const boostCount = await prisma.questionBoost.count({
    where: { questionId: id },
  })

  return Response.json(
    { boosted: true, boostCount, boostedByMe: true },
    { status: 201 }
  )
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.STUDENT) {
    return forbidden("Only students can remove boosts")
  }

  const { id } = await params

  const result = await prisma.questionBoost.deleteMany({
    where: { questionId: id, userId: user.id },
  })

  if (result.count === 0) {
    return conflict("Question is not boosted by you")
  }

  const boostCount = await prisma.questionBoost.count({
    where: { questionId: id },
  })

  return Response.json({
    boosted: false,
    boostCount,
    boostedByMe: false,
  })
}
