import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { badRequest, conflict, forbidden, notFound, unauthorized } from "@/lib/api"
import { ModerationStatus, ReportStatus, Role } from "@prisma/client"

const ACTIONS = ["DISMISS", "REMOVE_POST"] as const
type Action = (typeof ACTIONS)[number]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be valid JSON")
  }

  const action = body.action
  if (typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action)) {
    return badRequest("action must be DISMISS or REMOVE_POST")
  }

  const report = await prisma.questionReport.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      questionId: true,
      question: {
        select: {
          id: true,
          moderationStatus: true,
        },
      },
    },
  })

  if (!report) return notFound("Report not found")

  if (action === "DISMISS") {
    if (report.status !== ReportStatus.PENDING) {
      return conflict("Only pending reports can be dismissed")
    }

    const updated = await prisma.questionReport.update({
      where: { id },
      data: {
        status: ReportStatus.DISMISSED,
        reviewedAt: new Date(),
        reviewedById: user.id,
      },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
      },
    })

    return Response.json({ item: updated })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const question = await tx.question.update({
      where: { id: report.questionId },
      data: {
        moderationStatus: ModerationStatus.REJECTED,
        status: "CLOSED",
      },
      select: {
        id: true,
        moderationStatus: true,
        status: true,
      },
    })

    await tx.questionReport.updateMany({
      where: {
        questionId: report.questionId,
        status: ReportStatus.PENDING,
      },
      data: {
        status: ReportStatus.ACTION_TAKEN,
        reviewedAt: new Date(),
        reviewedById: user.id,
      },
    })

    return question
  })

  return Response.json({
    item: {
      id: report.id,
      status: ReportStatus.ACTION_TAKEN,
      moderationStatus: updated.moderationStatus,
      questionStatus: updated.status,
    },
  })
}
