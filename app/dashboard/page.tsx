import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"

type Question = {
  id: number
  title: string
  category: string
  status: string
}

export default async function Dashboard() {
  const session = await auth()
  if (!session) redirect("/login")

  const name = session.user?.email?.split("@")[0]

  const res = await fetch("http://localhost:3000/api/questions", { cache: "no-store" })
  const questions: Question[] = await res.json()

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Good morning, {name}</h1>
      <p>How can we help you today?</p>

      <div style={{ display: "flex", gap: 12, margin: "24px 0" }}>
        <button>Ask My Mentor</button>
        <button>Ask Any Mentor</button>
        <button>Ask Anonymously</button>
        <button>Browse Questions</button>
      </div>

      <h2>Recent Questions</h2>
      {questions.length === 0 ? (
        <p>No questions yet.</p>
      ) : (
        <ul>
          {questions.map((q) => (
            <li key={q.id}>
              <strong>{q.title}</strong> — {q.category} — <em>{q.status}</em>
            </li>
          ))}
        </ul>
      )}

      <form action={async () => {
        "use server"
        await signOut({ redirectTo: "/login" })
      }}>
        <button type="submit">Sign Out</button>
      </form>
    </div>
  )
}