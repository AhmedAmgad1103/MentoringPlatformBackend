import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { notFound, unauthorized } from "@/lib/api"
import { visibleWhere } from "@/lib/questions"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { id } = await params
  const question = await prisma.question.findFirst({
    where: { AND: [{ id }, visibleWhere(user)] },
    select: { id: true },
  })

  if (!question) return notFound("Question not found")

  await prisma.questionBoost.upsert({
    where: { questionId_userId: { questionId: id, userId: user.id } },
    update: {},
    create: { questionId: id, userId: user.id },
  })

  const boostCount = await prisma.questionBoost.count({
    where: { questionId: id },
  })

  return Response.json({ boosted: true, boostCount })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { id } = await params
  const question = await prisma.question.findFirst({
    where: { AND: [{ id }, visibleWhere(user)] },
    select: { id: true },
  })

  if (!question) return notFound("Question not found")

  await prisma.questionBoost.deleteMany({
    where: { questionId: id, userId: user.id },
  })

  const boostCount = await prisma.questionBoost.count({
    where: { questionId: id },
  })

  return Response.json({ boosted: false, boostCount })
}
