import { ModerationStatus, QuestionVisibility, Role } from "@prisma/client"
import type { CurrentUser } from "@/lib/session"

export function hasRole(user: CurrentUser, ...roles: Role[]) {
  return roles.includes(user.role)
}

export function canViewQuestion(
  user: CurrentUser,
  question: {
    studentId: string
    mentorId: string | null
    visibility: QuestionVisibility
    moderationStatus: ModerationStatus
  }
) {
  if (user.role === Role.ADMIN) return true

  if (user.role === Role.MENTOR) {
    return (
      question.mentorId === user.id ||
      (question.visibility === QuestionVisibility.PUBLIC &&
        question.moderationStatus === ModerationStatus.APPROVED) ||
      (question.visibility === QuestionVisibility.PUBLIC &&
        question.moderationStatus === ModerationStatus.NOT_REQUIRED)
    )
  }

  return (
    question.studentId === user.id ||
    (question.visibility === QuestionVisibility.PUBLIC &&
      question.moderationStatus === ModerationStatus.APPROVED)
  )
}

export function canMentorAnswerQuestion(
  user: CurrentUser,
  question: {
    mentorId: string | null
    visibility: QuestionVisibility
    moderationStatus: ModerationStatus
  }
) {
  if (user.role !== Role.MENTOR) return false

  if (question.mentorId === user.id) return true

  return (
    question.mentorId === null &&
    question.visibility === QuestionVisibility.PUBLIC &&
    (question.moderationStatus === ModerationStatus.APPROVED ||
      question.moderationStatus === ModerationStatus.NOT_REQUIRED)
  )
}
