import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { badRequest, conflict, forbidden, notFound, unauthorized } from "@/lib/api"
import { canViewQuestion } from "@/lib/authz"
import {
  ModerationStatus,
  ReportReason,
  Role,
} from "@prisma/client"

function isEnumValue<T extends Record<string, string>>(e: T, v: unknown): v is T[keyof T] {
  return typeof v === "string" && (Object.values(e) as string[]).includes(v)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.STUDENT && user.role !== Role.MENTOR) {
    return forbidden("Only students and mentors can report posts")
  }

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

  if (!question) return notFound("Post not found")
  if (question.studentId === user.id) {
    return conflict("You cannot report your own post")
  }

  if (
    !canViewQuestion(user, question) ||
    (question.moderationStatus !== ModerationStatus.APPROVED &&
      question.moderationStatus !== ModerationStatus.NOT_REQUIRED)
  ) {
    return forbidden("This post cannot be reported from your current view")
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be valid JSON")
  }

  const reason = body.reason
  if (!isEnumValue(ReportReason, reason)) {
    return badRequest("Invalid report reason")
  }

  const details =
    typeof body.details === "string" && body.details.trim()
      ? body.details.trim()
      : null

  if (details && details.length > 1000) {
    return badRequest("details must be 1000 characters or fewer")
  }

  const existing = await prisma.questionReport.findUnique({
    where: {
      questionId_reporterId: {
        questionId: id,
        reporterId: user.id,
      },
    },
    select: {
      id: true,
      status: true,
    },
  })

  if (existing) {
    if (existing.status === "DISMISSED") {
      const reactivated = await prisma.questionReport.update({
        where: { id: existing.id },
        data: {
          reason,
          details,
          status: "PENDING",
          reviewedAt: null,
          reviewedById: null,
        },
        select: {
          id: true,
          status: true,
          reason: true,
          createdAt: true,
        },
      })
      return Response.json({ item: reactivated })
    }

    return conflict("You have already reported this post")
  }

  const report = await prisma.questionReport.create({
    data: {
      questionId: id,
      reporterId: user.id,
      reason,
      details,
    },
    select: {
      id: true,
      status: true,
      reason: true,
      createdAt: true,
    },
  })

  return Response.json({ item: report }, { status: 201 })
}
