import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { unauthorized, forbidden } from "@/lib/api"
import { getRewardCycle } from "@/lib/rewards"
import { Role } from "@prisma/client"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.MENTOR) return forbidden("Mentor access required")

  const cycle = getRewardCycle()
  const items = await prisma.mentorPoint.findMany({
    where: { mentorId: user.id, month: cycle, points: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      points: true,
      reason: true,
      month: true,
      createdAt: true,
      answerId: true,
    },
  })

  return Response.json({
    cycle,
    items: items.map((item) => ({
      ...item,
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
    })),
  })
}
