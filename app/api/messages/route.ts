import { auth } from "@/auth"

type Message = {
  id: number
  recipientId: number
  body: string
  senderEmail: string
  createdAt: string
}

const messages: Message[] = []

export async function POST(request: Request) {
  const payload = await request.json() as { recipientId?: number; body?: string }

  if (!payload.recipientId || !payload.body?.trim()) {
    return Response.json({ error: "recipientId and body are required" }, { status: 400 })
  }

  const session = await auth()
  const message: Message = {
    id: Date.now(),
    recipientId: payload.recipientId,
    body: payload.body.trim(),
    senderEmail: session?.user?.email ?? "dev-user",
    createdAt: new Date().toISOString(),
  }

  messages.push(message)
  return Response.json(message, { status: 201 })
}
