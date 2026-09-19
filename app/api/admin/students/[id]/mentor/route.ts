import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import {
  badRequest,
  forbidden,
  notFound,
  unauthorized,
} from "@/lib/api"
import { Role } from "@prisma/client"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  const { id: studentId } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be valid JSON")
  }

  const mentorId = typeof body.mentorId === "string" ? body.mentorId.trim() : ""
  if (!mentorId) return badRequest("mentorId is required")

  const [student, mentor] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, role: Role.STUDENT },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { id: mentorId, role: Role.MENTOR },
      select: { id: true, name: true },
    }),
  ])

  if (!student) return notFound("Student not found")
  if (!mentor) return notFound("Mentor not found")

  const updated = await prisma.user.update({
    where: { id: studentId },
    data: { assignedMentorId: mentorId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      assignedMentor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  return Response.json({ item: updated })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  const { id: studentId } = await params

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: Role.STUDENT },
    select: { id: true },
  })

  if (!student) return notFound("Student not found")

  const updated = await prisma.user.update({
    where: { id: studentId },
    data: { assignedMentorId: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      assignedMentor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  return Response.json({ item: updated })
}
