import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function getSignedInUser() {
  const session = await auth()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) return null
  return prisma.user.findUnique({ where: { email } })
}

export async function GET() {
  const user = await getSignedInUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        message: true,
        kind: true,
        read: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ])

  return Response.json({ items, unreadCount })
}

export async function PATCH(request: Request) {
  const user = await getSignedInUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (body?.readAll === true) {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    })
    return Response.json({ ok: true })
  }

  const id = typeof body?.id === "string" ? body.id : ""
  if (!id) return Response.json({ error: "Notification id is required" }, { status: 400 })

  const result = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  })
  if (result.count === 0) {
    return Response.json({ error: "Notification not found" }, { status: 404 })
  }

  return Response.json({ ok: true })
}
