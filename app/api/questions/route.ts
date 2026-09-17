export async function GET() {
  return Response.json([
    { id: 1, title: "How do I prepare for Step 2 CK?", category: "Board Exams", status: "Answered" },
    { id: 2, title: "How do I manage burnout during rotations?", category: "Wellness & Burnout", status: "Awaiting Response" },
  ])
}