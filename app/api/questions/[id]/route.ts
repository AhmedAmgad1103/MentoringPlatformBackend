import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { notFound, unauthorized } from "@/lib/api"
import { detailSelect, toQuestionDTO, visibleWhere } from "@/lib/questions"

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
    answers,
  })
}