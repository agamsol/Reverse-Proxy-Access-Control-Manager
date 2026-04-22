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

function parseErrorDetail(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'detail' in raw) {
    const d = (raw as { detail: unknown }).detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) {
      return d
        .map((e) => (typeof e === 'object' && e && 'msg' in e ? String((e as { msg: unknown }).msg) : String(e)))
        .join(' ')
    }
  }
  return 'Request failed'
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
  constructor(status: number, statusText: string, message: string) {
    super(message)
    this.status = status
    this.statusText = statusText
    this.name = 'HttpError'
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
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new HttpError(res.status, res.statusText, parseErrorDetail(data))
  }
  return {
    data: data as RequestAccessResponse,
    status: res.status,
    statusText: res.statusText,
  }
}
