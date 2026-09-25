import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const mentor = await prisma.user.findUnique({ where: { email } })
  if (!mentor) return Response.json({ error: "User not found" }, { status: 404 })
  if (mentor.role !== "MENTOR") {
    return Response.json({ error: "Only mentors can view their mentees" }, { status: 403 })
  }

  const mentees = await prisma.user.findMany({
    where: { assignedMentorId: mentor.id, role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      _count: { select: { questions: true } },
    },
  })

  return Response.json({
    items: mentees.map((mentee) => ({
      id: mentee.id,
      name: mentee.name,
      email: mentee.email,
      avatarUrl: mentee.avatarUrl,
      createdAt: mentee.createdAt,
      questionCount: mentee._count.questions,
    })),
  })
}
