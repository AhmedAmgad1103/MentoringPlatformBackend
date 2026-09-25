import { prisma } from "@/lib/prisma"

export async function GET() {
  const questions = await prisma.question.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      createdAt: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  })

  return Response.json(questions)
}