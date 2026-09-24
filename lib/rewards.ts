import { Prisma, MentorPointReason } from "@prisma/client"

export const REWARD_POINTS = {
  ANSWER: 5,
  FAST_RESPONSE: 3,
  HELPFUL_VOTE: 2,
  ANY_MENTOR_RESPONSE: 1,
} as const

export function getRewardMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

export async function awardMentorPoints(
  tx: Prisma.TransactionClient,
  input: {
    mentorId: string
    points: number
    reason: MentorPointReason
    eventKey: string
    answerId?: string
    voterId?: string
  }
) {
  const month = getRewardMonth()

  return tx.mentorPoint.upsert({
    where: { eventKey: input.eventKey },
    update: {
      points: input.points,
      month,
      answerId: input.answerId,
      voterId: input.voterId,
    },
    create: {
      mentorId: input.mentorId,
      points: input.points,
      reason: input.reason,
      month,
      eventKey: input.eventKey,
      answerId: input.answerId,
      voterId: input.voterId,
    },
  })
}

export async function setHelpfulVoteReward(
  tx: Prisma.TransactionClient,
  input: {
    mentorId: string
    answerId: string
    voterId: string
    active: boolean
  }
) {
  const month = getRewardMonth()
  const eventKey = `helpful:${month}:${input.answerId}:${input.voterId}`

  return tx.mentorPoint.upsert({
    where: { eventKey },
    update: {
      points: input.active ? REWARD_POINTS.HELPFUL_VOTE : 0,
      month,
    },
    create: {
      mentorId: input.mentorId,
      points: input.active ? REWARD_POINTS.HELPFUL_VOTE : 0,
      reason: MentorPointReason.HELPFUL_VOTE,
      month,
      eventKey,
      answerId: input.answerId,
      voterId: input.voterId,
    },
  })
}
