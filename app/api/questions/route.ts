import { auth } from "@/auth"

type Question = {
  id: number
  title: string
  category: string
  status: string
  body?: string
  privacy?: string
  authorEmail?: string
}

let questions: Question[] = [
  { id: 1, title: "How do I prepare for Step 2 CK?", category: "Board Exams", status: "Answered", body: "Placeholder question from the development backend.", privacy: "any-mentor", authorEmail: "student@university.edu" },
  { id: 2, title: "How do I manage burnout during rotations?", category: "Wellness & Burnout", status: "Awaiting Response", body: "Placeholder question from the development backend.", privacy: "private", authorEmail: "student@university.edu" },
]

export async function GET() {
  return Response.json(questions)
}

export async function POST(request: Request) {
  const payload = await request.json() as Partial<Question>

  if (!payload.title?.trim() || !payload.category?.trim() || !payload.body?.trim() || !payload.privacy?.trim()) {
    return Response.json({ error: "title, category, body, and privacy are required" }, { status: 400 })
  }

  const session = await auth()
  const question: Question = {
    id: Date.now(),
    title: payload.title.trim(),
    category: payload.category.trim(),
    status: payload.privacy === "anon-public" ? "Pending Approval" : "Awaiting Response",
    body: payload.body.trim(),
    privacy: payload.privacy.trim(),
    authorEmail: session?.user?.email ?? "dev-user",
  }

  questions = [question, ...questions]
  return Response.json(question, { status: 201 })
}