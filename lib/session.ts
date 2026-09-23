import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"

export type CurrentUser = {
  id: string
  email: string
  name: string | null
  role: Role
  assignedMentorId: string | null
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  assignedMentorId: true,
} as const

const DEV_ROLE_MAP: Record<string, Role> = {
  mentee: Role.STUDENT,
  student: Role.STUDENT,
  mentor: Role.MENTOR,
  admin: Role.ADMIN,
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) return null

  let devRole: Role | undefined
  if (process.env.NODE_ENV !== "production") {
    const raw = (session?.user as unknown as { role?: string })?.role
    devRole = DEV_ROLE_MAP[String(raw ?? "").toLowerCase()]
  }

  let user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: email.split("@")[0],
      role: devRole ?? Role.STUDENT,
    },
    select: userSelect,
  })

  // An existing database user keeps their persisted role. The development
  // role is only used when the account is first created.
  return user
}