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

  const reward = await tx.mentorPoint.upsert({
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

  if (input.points > 0) {
    const reasonText: Record<MentorPointReason, string> = {
      ANSWER: "answer a student's question",
      FAST_RESPONSE: "answer within 24 hours",
      HELPFUL_VOTE: "receive a helpful vote",
      ANY_MENTOR_RESPONSE: "answer an Ask Any Mentor question",
    }

    await tx.notification.upsert({
      where: { dedupeKey: `mentor-reward:${input.eventKey}` },
      update: {
        title: `You earned +${input.points} mentor points`,
        message: `You earned +${input.points} points for ${reasonText[input.reason]}.`,
        kind: "MENTOR_REWARD_EARNED",
      },
      create: {
        userId: input.mentorId,
        title: `You earned +${input.points} mentor points`,
        message: `You earned +${input.points} points for ${reasonText[input.reason]}.`,
        kind: "MENTOR_REWARD_EARNED",
        dedupeKey: `mentor-reward:${input.eventKey}`,
      },
    })
  }

  return reward
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

  const reward = await tx.mentorPoint.upsert({
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

  if (input.active) {
    await tx.notification.upsert({
      where: { dedupeKey: `mentor-reward:${eventKey}` },
      update: {
        title: `You earned +${REWARD_POINTS.HELPFUL_VOTE} mentor points`,
        message: `You earned +${REWARD_POINTS.HELPFUL_VOTE} points because a student marked your answer helpful.`,
        kind: "MENTOR_REWARD_EARNED",
      },
      create: {
        userId: input.mentorId,
        title: `You earned +${REWARD_POINTS.HELPFUL_VOTE} mentor points`,
        message: `You earned +${REWARD_POINTS.HELPFUL_VOTE} points because a student marked your answer helpful.`,
        kind: "MENTOR_REWARD_EARNED",
        dedupeKey: `mentor-reward:${eventKey}`,
      },
    })
  }

  return reward
}
