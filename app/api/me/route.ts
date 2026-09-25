import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function getSignedInUser() {
  const session = await auth()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) return null
  return prisma.user.findUnique({
    where: { email },
    include: {
      assignedMentor: { select: { id: true, name: true, avatarUrl: true } },
    },
  })
}

export async function GET() {
  const user = await getSignedInUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    assignedMentor: user.assignedMentor,
  })
}

export async function PATCH(request: Request) {
  const user = await getSignedInUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const data: { name?: string | null; avatarUrl?: string | null } = {}

  if (Object.prototype.hasOwnProperty.call(body ?? {}, "name")) {
    if (body.name !== null && typeof body.name !== "string") {
      return Response.json({ error: "name must be a string or null" }, { status: 400 })
    }
    const name = typeof body.name === "string" ? body.name.trim() : null
    if (name && name.length > 100) {
      return Response.json({ error: "Name must be 100 characters or fewer" }, { status: 400 })
    }
    data.name = name || null
  }

  if (Object.prototype.hasOwnProperty.call(body ?? {}, "avatarUrl")) {
    if (body.avatarUrl !== null && typeof body.avatarUrl !== "string") {
      return Response.json({ error: "avatarUrl must be a string or null" }, { status: 400 })
    }
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : null
    if (avatarUrl && avatarUrl.length > 5_000_000) {
      return Response.json({ error: "Profile image is too large" }, { status: 413 })
    }
    data.avatarUrl = avatarUrl || null
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No profile fields provided" }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
      assignedMentor: { select: { id: true, name: true, avatarUrl: true } },
    },
  })

  return Response.json(updated)
}
