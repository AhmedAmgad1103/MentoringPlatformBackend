import { signIn, auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return (
    <form action={async (formData) => {
      "use server"
      await signIn("credentials", {
        email: formData.get("email"),
        role: formData.get("role"),
        redirectTo: "/dashboard",
      })
    }}>
      <input name="email" placeholder="test@university.edu" />
      <input name="role" placeholder="mentee / mentor / admin" />
      <button type="submit">Dev Sign In</button>
    </form>
  )
}