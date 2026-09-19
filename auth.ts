import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        role: { label: "Role", type: "text" },
      },
      authorize(credentials) {
        return {
          id: "dev-user",
          email: credentials.email as string,
          role: (credentials.role as string) || "mentee",
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as unknown as { role?: string }).role
      return token
    },
    session({ session, token }) {
      if (token.role) {
        ;(session.user as unknown as { role?: string }).role = token.role as string
      }
      return session
    },
  },
})