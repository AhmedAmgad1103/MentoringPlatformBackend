import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { unauthorized } from "@/lib/api"
import { getRewardCycle } from "@/lib/rewards"
import { MentorStatus, Role } from "@prisma/client"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const cycle = getRewardCycle()

  const [mentors, totals] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: Role.MENTOR,
        mentorStatus: MentorStatus.APPROVED,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
    prisma.mentorPoint.groupBy({
      by: ["mentorId"],
      where: {
        cycle,
        points: { gt: 0 },
      },
      _sum: { points: true },
    }),
  ])

  const totalsByMentor = new Map(
    totals.map((row) => [row.mentorId, row._sum.points ?? 0])
  )

  const items = mentors
    .map((mentor) => ({
      id: mentor.id,
      name: mentor.name,
      email: mentor.email,
      points: totalsByMentor.get(mentor.id) ?? 0,
    }))
    .sort((a, b) => b.points - a.points || (a.name ?? "").localeCompare(b.name ?? ""))
    .map((mentor, index) => ({
      ...mentor,
      rank: index + 1,
    }))

  const me =
    user.role === Role.MENTOR
      ? items.find((mentor) => mentor.id === user.id) ?? null
      : null

  return Response.json({
    month,
    items,
    me,
  })
}
