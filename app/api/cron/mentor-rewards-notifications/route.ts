import { prisma } from "@/lib/prisma"
import { getRewardCycle } from "@/lib/rewards"
import { MentorStatus, Role } from "@prisma/client"

export const dynamic = "force-dynamic"

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (expected && request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const day = now.getUTCDate()
  const lastDay = daysInMonth(year, month)
  const daysLeft = lastDay - day
  const cycle = getRewardCycle()

  // Monthly reminder cadence:
  // 7 days out -> weekly-style reminder
  // 3 days out -> more urgent reminder
  // final 2 days -> daily reminder
  // 1st of the new month -> new-cycle reminder
  const shouldNotify = day === 1 || daysLeft <= 7
  if (!shouldNotify) {
    return Response.json({ ok: true, sent: 0, daysLeft })
  }

  const mentors = await prisma.user.findMany({
    where: {
      role: Role.MENTOR,
      mentorStatus: MentorStatus.APPROVED,
    },
    select: { id: true, name: true },
  })

  const totals = await prisma.mentorPoint.groupBy({
    by: ["mentorId"],
    where: { month: cycle, points: { gt: 0 } },
    _sum: { points: true },
  })

  const pointsByMentor = new Map(totals.map((row) => [row.mentorId, row._sum.points ?? 0]))
  const sorted = mentors
    .map((mentor) => ({ id: mentor.id, name: mentor.name, points: pointsByMentor.get(mentor.id) ?? 0 }))
    .sort((a, b) => b.points - a.points || (a.name ?? "").localeCompare(b.name ?? ""))

  const rankByMentor = new Map(sorted.map((mentor, index) => [mentor.id, index + 1]))
  const dateKey = now.toISOString().slice(0, 10)

  const data = mentors.map((mentor) => {
    const name = mentor.name?.trim() || "Doctor"
    const points = pointsByMentor.get(mentor.id) ?? 0
    const rank = rankByMentor.get(mentor.id) ?? sorted.length
    const rankText = sorted.length ? `You're currently #${rank} with ${points} points.` : "You haven't earned points yet."

    let title: string
    let message: string
    if (day === 1) {
      title = "A new mentor reward month has started"
      message = `Hi ${name}, a new month is underway. ${rankText} Keep answering questions and helping students.`
    } else if (daysLeft === 1) {
      title = "1 day left in this month's mentor rewards"
      message = `Hi ${name}, there's 1 day left this month. ${rankText} This is a good time to answer open questions and check your helpful votes.`
    } else if (daysLeft <= 3) {
      title = `${daysLeft} days left in mentor rewards`
      message = `Hi ${name}, the month is nearly over. ${rankText} You can still earn more points by helping students.`
    } else {
      title = "Mentor rewards: 7 days left"
      message = `Hi ${name}, 7 days remain this month. ${rankText} Keep contributing to move up the leaderboard.`
    }

    return {
      userId: mentor.id,
      title,
      message,
      kind: "MENTOR_REWARDS_REMINDER",
      dedupeKey: `mentor-rewards:${dateKey}:${mentor.id}`,
    }
  })

  const result = await prisma.notification.createMany({ data, skipDuplicates: true })
  return Response.json({ ok: true, sent: result.count, daysLeft })
}
