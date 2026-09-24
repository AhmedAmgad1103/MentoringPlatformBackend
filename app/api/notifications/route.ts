import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { unauthorized } from "@/lib/api"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, read: false },
  })

  return Response.json({ items, unreadCount })
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === "string" ? body.id : null
  const readAll = body.readAll === true

  if (readAll) {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    })
    return Response.json({ ok: true })
  }

  if (!id) return Response.json({ error: "id is required" }, { status: 400 })

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  })

  return Response.json({ ok: true })
}
