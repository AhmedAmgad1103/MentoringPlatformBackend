export type QuestionCategory =
  | "BOARD_EXAMS"
  | "WELLNESS_BURNOUT"
  | "CLINICAL_ROTATIONS"
  | "ACADEMICS"
  | "CAREER"
  | "RESEARCH"
  | "STUDY_SKILLS"
  | "OTHER"

export type QuestionStatus =
  | "AWAITING_RESPONSE"
  | "ANSWERED"
  | "CLOSED"

export type QuestionVisibility = "PRIVATE" | "PUBLIC"
export type ModerationStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"

export type ApiQuestion = {
  id: string
  title: string
  content: string
  category: QuestionCategory
  visibility: QuestionVisibility
  isAnonymous: boolean
  status: QuestionStatus
  moderationStatus: ModerationStatus
  createdAt: string
  updatedAt: string
  isMine: boolean
  student: { id: string; name: string | null } | null
  mentor: { id: string; name: string | null } | null
  boostCount: number
  answerCount: number
  boostedByMe: boolean
}

export type ApiAnswer = {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  mentor: { id: string; name: string | null }
}

export type ApiUser = {
  id: string
  email: string
  name: string | null
  role: "STUDENT" | "MENTOR" | "ADMIN"
  assignedMentor: { id: string; name: string | null } | null
}

type QuestionListResponse = {
  items: ApiQuestion[]
  page: number
  limit: number
  total: number
}

type AnswerListResponse = {
  items: ApiAnswer[]
}

const API_BASE_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3000"
).replace(/\/$/, "")

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed with status ${response.status}`

    throw new ApiError(message, response.status, data)
  }

  return data as T
}

export async function getQuestions(options: {
  scope?: "mine" | "assigned" | "mentor-community" | "public" | "all"
  category?: QuestionCategory
  status?: QuestionStatus
  sort?: "recent" | "boosted"
  page?: number
  limit?: number
} = {}) {
  const params = new URLSearchParams()

  if (options.scope) params.set("scope", options.scope)
  if (options.category) params.set("category", options.category)
  if (options.status) params.set("status", options.status)
  if (options.sort) params.set("sort", options.sort)
  if (options.page !== undefined) params.set("page", String(options.page))
  if (options.limit !== undefined) params.set("limit", String(options.limit))

  const query = params.toString()
  return request<QuestionListResponse>(`/api/questions${query ? `?${query}` : ""}`)
}

export async function getQuestion(questionId: string) {
  return request<ApiQuestion & { answers: ApiAnswer[] }>(
    `/api/questions/${encodeURIComponent(questionId)}`
  )
}

export async function createQuestion(input: {
  title: string
  body: string
  category?: QuestionCategory
  askType: "MY_MENTOR" | "ANY_MENTOR" | "ANONYMOUS"
  privacy?: QuestionVisibility
  mentorId?: string
}) {
  return request<ApiQuestion>("/api/questions", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function getAnswers(questionId: string) {
  return request<AnswerListResponse>(
    `/api/questions/${encodeURIComponent(questionId)}/answers`
  )
}

export async function createAnswer(questionId: string, content: string) {
  return request<{
    item: ApiAnswer
    questionStatus: QuestionStatus
  }>(`/api/questions/${encodeURIComponent(questionId)}/answers`, {
    method: "POST",
    body: JSON.stringify({ content }),
  })
}

export async function updateAnswer(
  questionId: string,
  answerId: string,
  content: string
) {
  return request<{ item: ApiAnswer }>(
    `/api/questions/${encodeURIComponent(questionId)}/answers/${encodeURIComponent(answerId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }
  )
}

export async function deleteAnswer(questionId: string, answerId: string) {
  return request<{ deleted: true; questionHasAnswers: boolean }>(
    `/api/questions/${encodeURIComponent(questionId)}/answers/${encodeURIComponent(answerId)}`,
    { method: "DELETE" }
  )
}

export async function getNotifications() {
  throw new Error("Notifications API is intentionally not added yet.")
}

export async function markNotificationRead(_notificationId: string) {
  throw new Error("Notifications API is intentionally not added yet.")
}

export async function markAllNotificationsRead() {
  throw new Error("Notifications API is intentionally not added yet.")
}

export async function approveQuestion(questionId: string) {
  return request<{ item: { id: string; moderationStatus: ModerationStatus; status: QuestionStatus } }>(
    `/api/admin/questions/${encodeURIComponent(questionId)}/approve`,
    { method: "POST" }
  )
}

export async function rejectQuestion(questionId: string) {
  return request<{ item: { id: string; moderationStatus: ModerationStatus; status: QuestionStatus } }>(
    `/api/admin/questions/${encodeURIComponent(questionId)}/reject`,
    { method: "POST" }
  )
}

export async function getModerationQueue(options: { page?: number; limit?: number } = {}) {
  const params = new URLSearchParams()
  if (options.page !== undefined) params.set("page", String(options.page))
  if (options.limit !== undefined) params.set("limit", String(options.limit))

  const query = params.toString()
  return request<{
    items: Array<{
      id: string
      title: string
      content: string
      category: QuestionCategory
      visibility: QuestionVisibility
      isAnonymous: boolean
      status: QuestionStatus
      moderationStatus: ModerationStatus
      createdAt: string
      updatedAt: string
      student: { id: string; name: string | null; email: string }
    }>
    page: number
    limit: number
    total: number
  }>(`/api/admin/moderation${query ? `?${query}` : ""}`)
}

export async function getMentors() {
  return request<{
    items?: Array<{ id: string; name: string | null; email?: string; isMyMentor?: boolean }>
  }>("/api/mentors")
}

export async function getAdminMentors() {
  return request<{
    items: Array<{
      id: string
      name: string | null
      email: string
      createdAt: string
      studentCount: number
      answerCount: number
    }>
  }>("/api/admin/mentors")
}

export async function getAdminUsers(options: {
  role?: "STUDENT" | "MENTOR" | "ADMIN"
  q?: string
  page?: number
  limit?: number
} = {}) {
  const params = new URLSearchParams()
  if (options.role) params.set("role", options.role)
  if (options.q) params.set("q", options.q)
  if (options.page !== undefined) params.set("page", String(options.page))
  if (options.limit !== undefined) params.set("limit", String(options.limit))

  const query = params.toString()
  return request<{
    items: Array<
      ApiUser & {
        createdAt: string
        questionCount: number
        answerCount: number
      }
    >
    page: number
    limit: number
    total: number
  }>(`/api/admin/users${query ? `?${query}` : ""}`)
}

export async function assignMentor(studentId: string, mentorId: string) {
  return request<{ item: ApiUser }>(
    `/api/admin/students/${encodeURIComponent(studentId)}/mentor`,
    {
      method: "POST",
      body: JSON.stringify({ mentorId }),
    }
  )
}

export async function unassignMentor(studentId: string) {
  return request<{ item: ApiUser }>(
    `/api/admin/students/${encodeURIComponent(studentId)}/mentor`,
    {
      method: "DELETE",
    }
  )
}

export async function getMentorProfile(mentorId: string) {
  return request<{
    id: string
    name: string | null
    role: "MENTOR"
    createdAt: string
    studentCount: number
    answerCount: number
    isMyMentor: boolean
  }>(`/api/mentors/${encodeURIComponent(mentorId)}`)
}

export async function getMe() {
  return request<ApiUser>("/api/me")
}

export async function updateMe(input: { name: string | null }) {
  return request<ApiUser>("/api/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}
