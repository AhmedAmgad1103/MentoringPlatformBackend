import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function getSignedInUser() {
  const session = await auth()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) return null
  return prisma.user.findUnique({ where: { email } })
}

export async function GET(request: Request) {
  const user = await getSignedInUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const withUserId = url.searchParams.get("withUserId")
  const beforeParam = url.searchParams.get("before")
  if (!withUserId) {
    return Response.json({ error: "withUserId is required" }, { status: 400 })
  }

  const peer = await prisma.user.findUnique({ where: { id: withUserId } })
  if (!peer) return Response.json({ error: "User not found" }, { status: 404 })

  const isAssignedPair =
    (user.role === "MENTOR" && peer.assignedMentorId === user.id) ||
    (user.role === "STUDENT" && user.assignedMentorId === peer.id)
  if (!isAssignedPair) {
    return Response.json({ error: "Messages are only available between assigned mentor and mentee" }, { status: 403 })
  }

  const before = beforeParam ? new Date(beforeParam) : null
  if (before && Number.isNaN(before.getTime())) {
    return Response.json({ error: "Invalid before timestamp" }, { status: 400 })
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: user.id, recipientId: peer.id },
        { senderId: peer.id, recipientId: user.id },
      ],
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 51,
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      readAt: true,
      senderId: true,
      recipientId: true,
    },
  })

  const hasMore = messages.length > 50
  return Response.json({
    items: messages.slice(0, 50).reverse(),
    hasMore,
  })
}

export async function POST(request: Request) {
  const user = await getSignedInUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "MENTOR" && user.role !== "STUDENT") {
    return Response.json({ error: "Only mentors and students can send messages" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const recipientId = typeof body?.recipientId === "string" ? body.recipientId : ""
  const content = typeof body?.content === "string" ? body.content.trim() : ""
  if (!recipientId || !content) {
    return Response.json({ error: "recipientId and content are required" }, { status: 400 })
  }
  if (content.length > 10000) {
    return Response.json({ error: "Message must be 10,000 characters or fewer" }, { status: 400 })
  }
  if (recipientId === user.id) {
    return Response.json({ error: "You cannot message yourself" }, { status: 400 })
  }

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } })
  if (!recipient) return Response.json({ error: "Recipient not found" }, { status: 404 })

  const isAssignedPair =
    (user.role === "MENTOR" && recipient.assignedMentorId === user.id) ||
    (user.role === "STUDENT" && user.assignedMentorId === recipient.id)
  if (!isAssignedPair) {
    return Response.json({ error: "You can only message your assigned mentor or mentee" }, { status: 403 })
  }

  const senderName = user.name?.trim() || (user.role === "MENTOR" ? "Your mentor" : "Your mentee")
  const title = user.role === "MENTOR" ? "Your mentor sent you a message" : "Your mentee sent you a message"
  const preview = content.length > 180 ? `${content.slice(0, 177)}…` : content

  const [item] = await prisma.$transaction([
    prisma.message.create({
      data: {
        content,
        senderId: user.id,
        recipientId: recipient.id,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        readAt: true,
        senderId: true,
        recipientId: true,
      },
    }),
    prisma.notification.create({
      data: {
        userId: recipient.id,
        title,
        message: `${senderName}: ${preview}`,
        kind: "MESSAGE",
      },
    }),
  ])

  return Response.json({ item }, { status: 201 })
}
