import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { forbidden, unauthorized } from "@/lib/api"
import { Role } from "@prisma/client"

const pendingQuestionSelect = {
  id: true,
  title: true,
  content: true,
  category: true,
  visibility: true,
  isAnonymous: true,
  status: true,
  moderationStatus: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  const params = new URL(request.url).searchParams
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1)
  const limit = Math.min(
    50,
    Math.max(1, parseInt(params.get("limit") ?? "20", 10) || 20)
  )

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where: { moderationStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: pendingQuestionSelect,
    }),
    prisma.question.count({
      where: { moderationStatus: "PENDING" },
    }),
  ])

  return Response.json({ items, page, limit, total })
}
