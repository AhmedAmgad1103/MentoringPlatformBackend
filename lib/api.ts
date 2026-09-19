export const unauthorized = () =>
  Response.json({ error: "Not signed in" }, { status: 401 })

export const forbidden = (message = "Forbidden") =>
  Response.json({ error: message }, { status: 403 })

export const notFound = (message = "Not found") =>
  Response.json({ error: message }, { status: 404 })

export const badRequest = (message: string) =>
  Response.json({ error: message }, { status: 400 })

export const conflict = (message: string) =>
  Response.json({ error: message }, { status: 409 })