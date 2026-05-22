export type ServiceInfo = {
  name: string
  description: string | null
  internal_address: string
  port: number
  protocol: 'http' | 'https'
  /** When set, services are grouped under this label in the request UI */
  category?: string | null
}

export type StatusInfo = {
  version: string
  filesystem: 'nt' | 'posix'
  maintenance: boolean
}

export type ContactFieldFlags = {
  visible: boolean
  required: boolean
}

export type ContactFieldsConfig = {
  name: ContactFieldFlags
  email: ContactFieldFlags
  phone_number: ContactFieldFlags
}

export type ContactFieldName = keyof ContactFieldsConfig

export type AccessRequestPayload = {
  services: { name: string; expiry: number | null }[]
  contact_methods: {
    name: string | null
    email: string | null
    phone_number: string | null
  }
  note: string | null
  location: { lat: number | null; lon: number | null }
}

export type RequestAccessResponse = {
  ip_address: string
  services_requested: { name: string; expiry: number | null }[]
  message: string
}

export type RequestAccessBlock = {
  code: 'connection_ignored' | 'connection_revoked'
  services: string[]
}

/** `POST /request-access` 409 `request_access_conflict` body (subset parsed for UI). */
export type RequestAccessConflict = {
  already_pending: string[]
  already_allowed: string[]
}

function parseErrorDetail(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'detail' in raw) {
    const d = (raw as { detail: unknown }).detail
    if (typeof d === 'string') return d
    if (d && typeof d === 'object' && !Array.isArray(d) && 'message' in d) {
      const m = (d as { message: unknown }).message
      if (typeof m === 'string') return m
    }
    if (Array.isArray(d)) {
      return d
        .map((e) =>
          typeof e === 'object' && e && 'msg' in e ? String((e as { msg: unknown }).msg) : String(e),
        )
        .join(' ')
    }
  }
  return 'Request failed'
}

function extractRequestAccessBlock(data: unknown): RequestAccessBlock | null {
  if (!data || typeof data !== 'object' || !('detail' in data)) return null
  const detail = (data as { detail: unknown }).detail
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const o = detail as { code?: unknown; services?: unknown }
  const code = o.code
  if (
    (code === 'connection_ignored' || code === 'connection_revoked') &&
    Array.isArray(o.services)
  ) {
    const out = o.services.filter((x): x is string => typeof x === 'string')
    if (out.length === 0) return null
    return { code: code as RequestAccessBlock['code'], services: out }
  }
  return null
}

function extractRequestAccessConflict(data: unknown): RequestAccessConflict | null {
  if (!data || typeof data !== 'object' || !('detail' in data)) return null
  const detail = (data as { detail: unknown }).detail
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const o = detail as { code?: unknown; already_pending?: unknown; already_allowed?: unknown }
  if (o.code !== 'request_access_conflict') return null
  const pending = Array.isArray(o.already_pending)
    ? o.already_pending.filter((x): x is string => typeof x === 'string')
    : []
  const allowed = Array.isArray(o.already_allowed)
    ? o.already_allowed.filter((x): x is string => typeof x === 'string')
    : []
  if (pending.length === 0 && allowed.length === 0) return null
  return { already_pending: pending, already_allowed: allowed }
}

export async function getStatus(): Promise<StatusInfo> {
  const res = await fetch('/status')
  if (!res.ok) throw new Error(`Status ${res.status}`)
  return res.json() as Promise<StatusInfo>
}

export async function getServices(): Promise<ServiceInfo[]> {
  const res = await fetch('/services')
  if (!res.ok) throw new Error(`Could not load services (${res.status})`)
  return res.json() as Promise<ServiceInfo[]>
}

export async function getContactFieldsConfig(): Promise<ContactFieldsConfig> {
  const res = await fetch('/config/contact-fields')
  if (!res.ok) throw new Error(`Could not load contact fields config (${res.status})`)
  return res.json() as Promise<ContactFieldsConfig>
}

export type AccessCheckResult = 'granted' | 'blocked' | 'unknown'

export type AccessCheckResponse = {
  result: AccessCheckResult
  status: number
  statusText: string
  readable: boolean
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function checkDestinationAccess(
  url: string,
  timeoutMs = 6000,
): Promise<AccessCheckResponse> {
  // Prefer a CORS request so we can read the true status code when the
  // target service exposes CORS headers.
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'manual',
      },
      timeoutMs,
    )
    if (res.type === 'opaqueredirect') {
      return { result: 'blocked', status: 302, statusText: 'Redirect', readable: false }
    }
    return {
      result: res.ok ? 'granted' : 'blocked',
      status: res.status,
      statusText: res.statusText,
      readable: true,
    }
  } catch {
    // CORS not allowed or similar; fall back to an opaque probe.
  }

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'manual',
      },
      timeoutMs,
    )
    if (res.type === 'opaqueredirect') {
      return { result: 'blocked', status: 302, statusText: 'Redirect', readable: false }
    }
    return { result: 'granted', status: 200, statusText: 'Reachable', readable: false }
  } catch {
    return { result: 'unknown', status: 0, statusText: 'Network error', readable: false }
  }
}

export class HttpError extends Error {
  status: number
  statusText: string
  requestAccessBlock?: RequestAccessBlock
  requestAccessConflict?: RequestAccessConflict
  constructor(
    status: number,
    statusText: string,
    message: string,
    opts?: { requestAccessBlock?: RequestAccessBlock; requestAccessConflict?: RequestAccessConflict },
  ) {
    super(message)
    this.status = status
    this.statusText = statusText
    this.name = 'HttpError'
    this.requestAccessBlock = opts?.requestAccessBlock
    this.requestAccessConflict = opts?.requestAccessConflict
  }
}

export type SubmitAccessRequestResult = {
  data: RequestAccessResponse
  status: number
  statusText: string
}

export async function submitAccessRequest(
  body: AccessRequestPayload,
): Promise<SubmitAccessRequestResult> {
  const res = await fetch('/request-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: unknown = {}
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = {}
    }
  }
  if (!res.ok) {
    const block = res.status === 403 ? extractRequestAccessBlock(data) : null
    if (block) {
      throw new HttpError(res.status, res.statusText, parseErrorDetail(data), {
        requestAccessBlock: block,
      })
    }
    const conflict = res.status === 409 ? extractRequestAccessConflict(data) : null
    if (conflict) {
      throw new HttpError(res.status, res.statusText, parseErrorDetail(data), {
        requestAccessConflict: conflict,
      })
    }
    throw new HttpError(res.status, res.statusText, parseErrorDetail(data))
  }
  return {
    data: data as RequestAccessResponse,
    status: res.status,
    statusText: res.statusText,
  }
}
