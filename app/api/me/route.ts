import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { badRequest, unauthorized } from "@/lib/api"

const NAME_MAX = 100

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const assignedMentor = user.assignedMentorId
    ? await prisma.user.findUnique({
        where: { id: user.assignedMentorId },
        select: { id: true, name: true },
      })
    : null

  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    assignedMentor,
  })
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be valid JSON")
  }

  if (!Object.prototype.hasOwnProperty.call(body, "name")) {
    return badRequest("name is required")
  }

  const name =
    body.name === null
      ? null
      : typeof body.name === "string"
        ? body.name.trim()
        : undefined

  if (name === undefined) return badRequest("name must be a string or null")
  if (name !== null && (name.length < 2 || name.length > NAME_MAX)) {
    return badRequest("name must be 2-100 characters or null")
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name },
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

  return Response.json(updated)
}
