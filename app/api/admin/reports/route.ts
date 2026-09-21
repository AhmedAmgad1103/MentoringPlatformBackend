import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { badRequest, forbidden, unauthorized } from "@/lib/api"
import { ReportStatus, Role } from "@prisma/client"

const reportSelect = {
  id: true,
  reason: true,
  details: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
  question: {
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
      visibility: true,
      isAnonymous: true,
      moderationStatus: true,
      createdAt: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          reports: true,
        },
      },
    },
  },
  reporter: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const

function isEnumValue<T extends Record<string, string>>(e: T, v: unknown): v is T[keyof T] {
  return typeof v === "string" && (Object.values(e) as string[]).includes(v)
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  const params = new URL(request.url).searchParams
  const statusParam = params.get("status")
  if (
    statusParam &&
    statusParam !== "all" &&
    !isEnumValue(ReportStatus, statusParam)
  ) {
    return badRequest("Invalid report status")
  }

  const where = statusParam && statusParam !== "all"
    ? { status: statusParam as ReportStatus }
    : {}

  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1)
  const limit = Math.min(
    50,
    Math.max(1, parseInt(params.get("limit") ?? "20", 10) || 20)
  )

  const [items, total, pendingCount, dismissedCount, actionTakenCount] = await Promise.all([
    prisma.questionReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: reportSelect,
    }),
    prisma.questionReport.count({ where }),
    prisma.questionReport.count({ where: { status: ReportStatus.PENDING } }),
    prisma.questionReport.count({ where: { status: ReportStatus.DISMISSED } }),
    prisma.questionReport.count({ where: { status: ReportStatus.ACTION_TAKEN } }),
  ])

  return Response.json({
    items,
    page,
    limit,
    total,
    counts: {
      PENDING: pendingCount,
      DISMISSED: dismissedCount,
      ACTION_TAKEN: actionTakenCount,
    },
  })
}
