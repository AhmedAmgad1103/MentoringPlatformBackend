import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api"
import { Role } from "@prisma/client"

const CONTENT_MAX = 5000
const MAX_MESSAGES = 100

function canMessagePair(
  user: { id: string; role: Role },
  other: { id: string; role: Role },
  assignedMentorId: string | null,
  otherAssignedMentorId: string | null
) {
  if (user.role === Role.STUDENT && other.role === Role.MENTOR) {
    return assignedMentorId === other.id
  }

  if (user.role === Role.MENTOR && other.role === Role.STUDENT) {
    return otherAssignedMentorId === user.id
  }

  return false
}

const messageSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  readAt: true,
  senderId: true,
  recipientId: true,
} as const

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  if (user.role !== Role.STUDENT && user.role !== Role.MENTOR) {
    return forbidden("Only students and mentors can use messaging")
  }

  const params = new URL(request.url).searchParams
  const withUserId = params.get("withUserId")?.trim()
  if (!withUserId) return badRequest("withUserId is required")

  const other = await prisma.user.findUnique({
    where: { id: withUserId },
    select: {
      id: true,
      role: true,
      assignedMentorId: true,
    },
  })

  if (!other) return notFound("User not found")
  if (
    !canMessagePair(
      user,
      other,
      user.assignedMentorId,
      other.assignedMentorId
    )
  ) {
    return forbidden("You can only message your assigned mentor or mentee")
  }

  const before = params.get("before")
  const beforeDate = before ? new Date(before) : null
  if (beforeDate && Number.isNaN(beforeDate.getTime())) {
    return badRequest("before must be a valid ISO date")
  }

  const items = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: user.id, recipientId: other.id },
        { senderId: other.id, recipientId: user.id },
      ],
      ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_MESSAGES,
    select: messageSelect,
  })

  await prisma.message.updateMany({
    where: {
      senderId: other.id,
      recipientId: user.id,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  })

  return Response.json({
    items: items.reverse(),
    hasMore: items.length === MAX_MESSAGES,
  })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  if (user.role !== Role.STUDENT && user.role !== Role.MENTOR) {
    return forbidden("Only students and mentors can use messaging")
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be valid JSON")
  }

  const recipientId =
    typeof body.recipientId === "string" ? body.recipientId.trim() : ""
  const content = typeof body.content === "string" ? body.content.trim() : ""

  if (!recipientId) return badRequest("recipientId is required")
  if (!content) return badRequest("content is required")
  if (content.length > CONTENT_MAX) {
    return badRequest("content must be at most 5000 characters")
  }
  if (recipientId === user.id) {
    return badRequest("You cannot message yourself")
  }

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: {
      id: true,
      role: true,
      assignedMentorId: true,
    },
  })

  if (!recipient) return notFound("Recipient not found")

  if (
    !canMessagePair(
      user,
      recipient,
      user.assignedMentorId,
      recipient.assignedMentorId
    )
  ) {
    return forbidden("You can only message your assigned mentor or mentee")
  }

  const item = await prisma.message.create({
    data: {
      content,
      senderId: user.id,
      recipientId: recipient.id,
    },
    select: messageSelect,
  })

  return Response.json({ item }, { status: 201 })
}
