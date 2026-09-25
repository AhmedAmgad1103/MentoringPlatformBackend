import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { badRequest, forbidden, unauthorized } from "@/lib/api"
import { Role } from "@prisma/client"

const SETTINGS_ID = "platform"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  const settings = await prisma.platformSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { autoApprovePublicNonAnonymous: true },
  })

  return Response.json({
    autoApprovePublicNonAnonymous:
      settings?.autoApprovePublicNonAnonymous ?? false,
  })
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.ADMIN) return forbidden("Admin access required")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be valid JSON")
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("autoApprovePublicNonAnonymous" in body) ||
    typeof body.autoApprovePublicNonAnonymous !== "boolean"
  ) {
    return badRequest("autoApprovePublicNonAnonymous must be a boolean")
  }

  const autoApprovePublicNonAnonymous = body.autoApprovePublicNonAnonymous
  const settings = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      autoApprovePublicNonAnonymous,
    },
    update: {
      autoApprovePublicNonAnonymous,
    },
    select: { autoApprovePublicNonAnonymous: true },
  })

  return Response.json(settings)
}
