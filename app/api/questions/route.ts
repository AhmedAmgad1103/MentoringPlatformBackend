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
    },
  })

  return Response.json(questions)
}