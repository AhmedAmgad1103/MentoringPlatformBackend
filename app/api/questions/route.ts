import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "@/lib/api"
import {
  listSelect,
  mentorCommunityFeedWhere,
  publicFeedWhere,
  toQuestionDTO,
  visibleWhere,
} from "@/lib/questions"
import {
  ModerationStatus,
  Prisma,
  QuestionCategory,
  QuestionStatus,
  QuestionVisibility,
  Role,
} from "@prisma/client"

const SCOPES = ["mine", "assigned", "mentor-community", "public", "all"] as const
type Scope = (typeof SCOPES)[number]

const ASK_TYPES = ["MY_MENTOR", "ANY_MENTOR", "ANONYMOUS"] as const

const TITLE_MAX = 150
const CONTENT_MIN = 10
const CONTENT_MAX = 5000

function isEnumValue<T extends Record<string, string>>(
  e: T,
  v: unknown
): v is T[keyof T] {
  return typeof v === "string" && (Object.values(e) as string[]).includes(v)
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const params = new URL(request.url).searchParams

  const defaultScope: Scope =
    user.role === Role.ADMIN
      ? "all"
      : user.role === Role.MENTOR
        ? "assigned"
        : "mine"

  const scopeParam = params.get("scope")
  if (scopeParam && !(SCOPES as readonly string[]).includes(scopeParam)) {
    return badRequest("Invalid scope")
  }
  const scope = (scopeParam as Scope | null) ?? defaultScope

  if (scope === "assigned" && user.role !== Role.MENTOR) {
    return forbidden("Only mentors can use scope=assigned")
  }
  if (scope === "mentor-community" && user.role !== Role.MENTOR) {
    return forbidden("Only mentors can use scope=mentor-community")
  }
  if (scope === "all" && user.role !== Role.ADMIN) {
    return forbidden("Only admins can use scope=all")
  }

  const scopeWhere: Prisma.QuestionWhereInput =
    scope === "mine"
      ? { studentId: user.id }
      : scope === "assigned"
        ? { mentorId: user.id }
        : scope === "mentor-community"
          ? mentorCommunityFeedWhere
          : scope === "public"
            ? publicFeedWhere
            : {}

  const filters: Prisma.QuestionWhereInput = {}

  const category = params.get("category")
  if (category) {
    if (!isEnumValue(QuestionCategory, category)) {
      return badRequest("Invalid category")
    }
    filters.category = category
  }

  const status = params.get("status")
  if (status) {
    if (!isEnumValue(QuestionStatus, status)) {
      return badRequest("Invalid status")
    }
    filters.status = status
  }

  const sort = params.get("sort") ?? "recent"
  if (sort !== "recent" && sort !== "boosted") {
    return badRequest("sort must be recent or boosted")
  }

  const orderBy: Prisma.QuestionOrderByWithRelationInput[] =
    sort === "boosted"
      ? [{ boosts: { _count: "desc" } }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }]

  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1)
  const limit = Math.min(
    50,
    Math.max(1, parseInt(params.get("limit") ?? "20", 10) || 20)
  )

  const where: Prisma.QuestionWhereInput = {
    AND: [visibleWhere(user), scopeWhere, filters],
  }

  const [rows, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: listSelect(user.id),
    }),
    prisma.question.count({ where }),
  ])

  return Response.json({
    items: rows.map((r) => toQuestionDTO(r, user)),
    page,
    limit,
    total,
  })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  if (user.role !== Role.STUDENT) {
    return forbidden("Only students can ask questions")
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be valid JSON")
  }

  if (!body || typeof body !== "object") {
    return badRequest("Body must be a JSON object")
  }

  const title = typeof body.title === "string" ? body.title.trim() : ""
  const content = typeof body.content === "string"
    ? body.content.trim()
    : typeof body.body === "string"
      ? body.body.trim()
      : ""

  if (title.length < 3 || title.length > TITLE_MAX) {
    return badRequest("title must be 3-150 characters")
  }

  if (content.length < CONTENT_MIN || content.length > CONTENT_MAX) {
    return badRequest("content must be 10-5000 characters")
  }

  let category: QuestionCategory = QuestionCategory.OTHER
  if (body.category !== undefined) {
    if (!isEnumValue(QuestionCategory, body.category)) {
      return badRequest("Invalid category")
    }
    category = body.category
  }

  let askType = body.askType
  if (typeof askType !== "string" || !(ASK_TYPES as readonly string[]).includes(askType)) {
    const privacy = typeof body.privacy === "string" ? body.privacy.toLowerCase() : ""
    const legacyMap: Record<string, (typeof ASK_TYPES)[number]> = {
      private: "MY_MENTOR",
      "any-mentor": "ANY_MENTOR",
      "anon-public": "ANONYMOUS",
      "anon-private": "ANONYMOUS",
    }
    askType = legacyMap[privacy]
    if (!askType) return badRequest("askType must be MY_MENTOR, ANY_MENTOR, or ANONYMOUS")
    if (privacy === "anon-public") body.visibility = "PUBLIC"
    if (privacy === "anon-private") body.visibility = "PRIVATE"
  }

  let mentorId: string | null = null
  let visibility: QuestionVisibility = QuestionVisibility.PRIVATE
  let isAnonymous = false
  let moderationStatus: ModerationStatus = ModerationStatus.NOT_REQUIRED

  if (askType === "MY_MENTOR") {
    if (!user.assignedMentorId) {
      return conflict("You don't have an assigned mentor yet")
    }
    mentorId = user.assignedMentorId
  } else if (askType === "ANY_MENTOR") {
    visibility = QuestionVisibility.PUBLIC
    moderationStatus = ModerationStatus.NOT_REQUIRED
    mentorId = null
  } else {
    isAnonymous = true

    if (body.visibility !== undefined) {
      if (body.visibility !== "PRIVATE" && body.visibility !== "PUBLIC") {
        return badRequest("visibility must be PRIVATE or PUBLIC")
      }
      visibility = body.visibility as QuestionVisibility
    }

    if (visibility === QuestionVisibility.PUBLIC) {
      moderationStatus = ModerationStatus.PENDING
      mentorId = null
    } else {
      const chosen =
        typeof body.mentorId === "string" && body.mentorId
          ? body.mentorId
          : user.assignedMentorId

      if (!chosen) {
        return badRequest("mentorId is required for an anonymous private question")
      }

      mentorId = chosen
    }
  }

  if (mentorId) {
    const mentor = await prisma.user.findFirst({
      where: { id: mentorId, role: Role.MENTOR },
      select: { id: true },
    })

    if (!mentor) return notFound("Mentor not found")
  }

  const created = await prisma.question.create({
    data: {
      title,
      content,
      category,
      visibility,
      isAnonymous,
      moderationStatus,
      studentId: user.id,
      mentorId,
    },
    select: listSelect(user.id),
  })

  return Response.json(toQuestionDTO(created, user), { status: 201 })
}