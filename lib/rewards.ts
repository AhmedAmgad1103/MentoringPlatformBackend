import { Prisma, MentorPointReason } from "@prisma/client"

export const REWARD_POINTS = {
  ANSWER: 5,
  FAST_RESPONSE: 3,
  HELPFUL_VOTE: 2,
  ANY_MENTOR_RESPONSE: 1,
} as const

// The leaderboard is intentionally a single 2027 cycle. It resets on
// January 1, 2027 and stays on that cycle until this value is changed.
export const REWARD_CYCLE_START = "2027-01-01"
export const REWARD_CYCLE = "2027"

export function getRewardCycle() {
  return REWARD_CYCLE
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
  const month = getRewardCycle()

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
  const month = getRewardCycle()
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
