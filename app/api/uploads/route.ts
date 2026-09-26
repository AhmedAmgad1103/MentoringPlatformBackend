import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { badRequest, unauthorized } from "@/lib/api"
import { Role } from "@prisma/client"
import crypto from "node:crypto"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
])

function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "")
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "medmentor"
  if (!url || !serviceKey) {
    throw new Error("Supabase Storage is not configured")
  }
  return { url, serviceKey, bucket }
}

async function ensureBucket(url: string, serviceKey: string, bucket: string) {
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
  const check = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
    headers,
    cache: "no-store",
  })
  if (check.ok) return
  if (check.status !== 404) {
    throw new Error("Unable to check Supabase Storage bucket")
  }

  const create = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: true,
      file_size_limit: MAX_FILE_SIZE,
      allowed_mime_types: Array.from(ALLOWED_TYPES),
    }),
  })

  if (!create.ok && create.status !== 409) {
    throw new Error("Unable to create Supabase Storage bucket")
  }
}

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) return unauthorized()

  const rawRole = String((session.user as unknown as { role?: string })?.role ?? "").toLowerCase()
  const role = rawRole === "mentor" ? Role.MENTOR : rawRole === "admin" ? Role.ADMIN : Role.STUDENT
  const user = await prisma.user.upsert({
    where: { email_role: { email, role } },
    update: {},
    create: { email, name: email.split("@")[0], role },
    select: { id: true, role: true },
  })

  const form = await request.formData()
  const file = form.get("file")

  if (!(file instanceof File)) {
    return badRequest("file is required")
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return badRequest("File must be smaller than 10 MB")
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return badRequest("Only PDF, PNG, JPG, WEBP, and GIF files are supported")
  }

  let config
  try {
    config = storageConfig()
    await ensureBucket(config.url, config.serviceKey, config.bucket)
  } catch (error) {
    console.error("[upload] Storage configuration error:", error)
    return Response.json(
      { error: "File storage is not configured. Add the Supabase Storage environment variables." },
      { status: 503 },
    )
  }

  const extension = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() || "bin"
    : "bin"
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120)
  const path = `${user.role.toLowerCase()}/${user.id}/${crypto.randomUUID()}-${safeName || `file.${extension}`}`
  const bytes = await file.arrayBuffer()

  const upload = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceKey}`,
        apikey: config.serviceKey,
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      body: bytes,
    },
  )

  if (!upload.ok) {
    const detail = await upload.text().catch(() => "")
    console.error("[upload] Supabase upload failed:", upload.status, detail)
    return Response.json({ error: "Unable to upload file" }, { status: 502 })
  }

  const publicUrl = `${config.url}/storage/v1/object/public/${config.bucket}/${path.split("/").map(encodeURIComponent).join("/")}`

  return Response.json({
    url: publicUrl,
    name: file.name,
    type: file.type,
    size: file.size,
  }, { status: 201 })
}
