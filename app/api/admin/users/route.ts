import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { badRequest, forbidden, unauthorized } from "@/lib/api"
import { Role } from "@prisma/client"

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  const params = new URL(request.url).searchParams
  const roleParam = params.get("role")
  if (
    roleParam &&
    roleParam !== Role.STUDENT &&
    roleParam !== Role.MENTOR &&
    roleParam !== Role.ADMIN
  ) {
    return badRequest("Invalid role")
  }

  const search = params.get("q")?.trim() ?? ""
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1)
  const limit = Math.min(
    100,
    Math.max(1, parseInt(params.get("limit") ?? "25", 10) || 25)
  )

  const where = {
    ...(roleParam ? { role: roleParam as Role } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { name: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mentorStatus: true,
        createdAt: true,
        assignedMentor: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            questions: true,
            answers: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  return Response.json({
    items: items.map((item) => ({
      ...item,
      questionCount: item._count.questions,
      answerCount: item._count.answers,
    })),
    page,
    limit,
    total,
  })
}
