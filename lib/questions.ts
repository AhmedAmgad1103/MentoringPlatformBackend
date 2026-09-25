import { Prisma, ModerationStatus, QuestionVisibility, Role } from "@prisma/client"
import type { CurrentUser } from "@/lib/session"

const publicAndApproved = {
  visibility: QuestionVisibility.PUBLIC,
  moderationStatus: ModerationStatus.APPROVED,
} satisfies Prisma.QuestionWhereInput

// Ask Any Mentor is a mentor-community post.
// It is visible to every mentor, but not to students or the public feed.
// In the current schema it is represented as PUBLIC + NOT_REQUIRED.
const mentorCommunityWhere = {
  visibility: QuestionVisibility.PUBLIC,
  moderationStatus: ModerationStatus.NOT_REQUIRED,
} satisfies Prisma.QuestionWhereInput

export function visibleWhere(user: CurrentUser): Prisma.QuestionWhereInput {
  if (user.role === Role.ADMIN) return {}

  if (user.role === Role.MENTOR) {
    return {
      OR: [
        {
          mentorId: user.id,
          OR: [
            { moderationStatus: ModerationStatus.NOT_REQUIRED },
            { moderationStatus: ModerationStatus.APPROVED },
          ],
        },
        publicAndApproved,
      ],
    }
  }

  return {
    OR: [
      {
        AND: [
          { studentId: user.id },
          { moderationStatus: { not: ModerationStatus.REJECTED } },
        ],
      },
      publicAndApproved,
    ],
  }
}

export const publicFeedWhere = publicAndApproved
export const mentorCommunityFeedWhere = publicAndApproved

const baseSelect = {
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
  studentId: true,
  student: { select: { id: true, name: true, avatarUrl: true } },
  mentor: { select: { id: true, name: true } },
  _count: { select: { boosts: true, answers: true, reports: true } },
} satisfies Prisma.QuestionSelect

export function listSelect(viewerId: string) {
  return {
    ...baseSelect,
    boosts: { where: { userId: viewerId }, select: { id: true } },
    reports: { where: { reporterId: viewerId }, select: { id: true, status: true } },
  } satisfies Prisma.QuestionSelect
}

export function detailSelect(viewerId: string) {
  return {
    ...listSelect(viewerId),
    answers: {
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        mentor: { select: { id: true, name: true } },
        helpfulVotes: {
          select: { userId: true },
        },
      },
    },
  } satisfies Prisma.QuestionSelect
}

type ListRow = Prisma.QuestionGetPayload<{ select: ReturnType<typeof listSelect> }>
type DetailRow = Prisma.QuestionGetPayload<{ select: ReturnType<typeof detailSelect> }>

export function toQuestionDTO(row: ListRow | DetailRow, viewer: CurrentUser) {
  const hideStudent = row.isAnonymous && viewer.role !== Role.ADMIN

  const { studentId, student, _count, boosts, reports, ...rest } = row

  return {
    ...rest,
    isMine: studentId === viewer.id,
    student: hideStudent ? null : student,
    boostCount: _count.boosts,
    answerCount: _count.answers,
    reportedByMe: reports.length > 0,
    reportCount: viewer.role === Role.ADMIN ? _count.reports : undefined,
    boostedByMe: boosts.length > 0,
  }
}
