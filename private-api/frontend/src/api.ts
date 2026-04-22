import { clearToken, getToken } from './auth'

// -----------------------------------------------------------------------------
// Shared models
// -----------------------------------------------------------------------------

export type StatusInfo = {
  version: string
  filesystem: 'nt' | 'posix'
  maintenance: boolean
}

export type TokenPayloadModel = {
  username: string
  exp: number
}

export type AuthenticatedUser = {
  payload: TokenPayloadModel
  message: string
}

export type LoginResponse = {
  access_token: string
  token_type: string
}

export type Protocol = 'http' | 'https'

export type ServiceInfo = {
  name: string
  description: string | null
  internal_address: string
  port: number
  protocol: Protocol
}

export type ServiceEditPayload = {
  name?: string | null
  description?: string | null
  internal_address?: string | null
  port?: number | null
  protocol?: Protocol | null
}

/**
 * Contact info for a pending/allowed/ignored connection.
 *
 * The backend stores email/phone as a single-entry `{value: verified}` map.
 * We keep that raw shape for round-tripping, but callers typically pull out
 * the single key via `primaryEmail` / `primaryPhone` helpers below.
 */
export type ContactMethods = {
  name: string | null
  email: Record<string, boolean> | null
  phone_number: Record<string, boolean> | null
}

export type ServiceItem = {
  name: string
  expiry: number | null
}

export type LocationModel = {
  lat: number | null
  lon: number | null
}

export type PendingConnection = {
  _id: string | null
  contact_methods: ContactMethods
  ip_address: string
  service: ServiceItem | null
  location: LocationModel
  notes: string | null
}

export type AllowedConnection = {
  _id: string | null
  ip_address: string
  contact_methods: ContactMethods
  service_name: string
  ExpireAt: string | null
}

export type DeniedConnection = {
  _id: string | null
  contact_methods: ContactMethods
  ip_address: string
  service_name: string
}

export type AcceptPendingResponse = AllowedConnection

export type DenyPendingResponse = {
  message: string
  ip_address: string
  service_name: string
  ignore: boolean
}

export type WebhookEvent =
  | 'pending.new'
  | 'pending.accepted'
  | 'pending.denied'
  | 'connection.revoked'

export const WEBHOOK_EVENTS: readonly WebhookEvent[] = [
  'pending.new',
  'pending.accepted',
  'pending.denied',
  'connection.revoked',
] as const

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE'

export const HTTP_METHODS: readonly HttpMethod[] = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
] as const

export type Webhook = {
  event: WebhookEvent
  method: HttpMethod
  url: string
  headers: Record<string, unknown> | null
  query_params: Record<string, unknown> | null
  cookies: Record<string, unknown> | null
  body: Record<string, unknown> | null
}

export type WebhookModifyPayload = {
  event: WebhookEvent
  method?: HttpMethod | null
  url?: string | null
  headers?: Record<string, unknown> | null
  query_params?: Record<string, unknown> | null
  cookies?: Record<string, unknown> | null
  body?: Record<string, unknown> | null
}

export type DeleteServiceResponse = {
  service: string
  message: string
}

export type DeleteWebhookResponse = {
  event: WebhookEvent
  message: string
}

export type CreateWebhookResponse = Webhook & { message: string }

export type ModifyWebhookResponse = Webhook & { message: string }

// -----------------------------------------------------------------------------
// Contact helpers
// -----------------------------------------------------------------------------

/** First (and, per the backend, typically only) key from a `{value: verified}` map. */
export function primaryContactKey(
  map: Record<string, boolean> | null | undefined,
): string | null {
  if (!map) return null
  const keys = Object.keys(map)
  return keys.length > 0 ? keys[0] : null
}

export function primaryEmail(c: ContactMethods | null | undefined): string | null {
  return primaryContactKey(c?.email)
}

export function primaryPhone(c: ContactMethods | null | undefined): string | null {
  return primaryContactKey(c?.phone_number)
}

export function isEmailVerified(c: ContactMethods | null | undefined): boolean {
  if (!c?.email) return false
  const key = primaryContactKey(c.email)
  return key ? c.email[key] === true : false
}

export function isPhoneVerified(c: ContactMethods | null | undefined): boolean {
  if (!c?.phone_number) return false
  const key = primaryContactKey(c.phone_number)
  return key ? c.phone_number[key] === true : false
}

// -----------------------------------------------------------------------------
// Fetch layer
// -----------------------------------------------------------------------------

export class HttpError extends Error {
  status: number
  statusText: string
  detail: string
  constructor(status: number, statusText: string, detail: string) {
    super(detail || statusText || `HTTP ${status}`)
    this.status = status
    this.statusText = statusText
    this.detail = detail
    this.name = 'HttpError'
  }
}

function parseErrorDetail(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'detail' in raw) {
    const d = (raw as { detail: unknown }).detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) {
      return d
        .map((e) =>
          typeof e === 'object' && e && 'msg' in e
            ? String((e as { msg: unknown }).msg)
            : String(e),
        )
        .join(' ')
    }
  }
  return ''
}

export type UnauthorizedHandler = () => void

let onUnauthorized: UnauthorizedHandler | null = null

/** Register a handler invoked on every 401. Typically used to sign the user out. */
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  onUnauthorized = fn
}

type FetchMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

type FetchOpts = {
  method?: FetchMethod
  auth?: boolean
  json?: unknown
  form?: Record<string, string>
  signal?: AbortSignal
}

async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { method = 'GET', auth = true, json, form, signal } = opts
  const headers: Record<string, string> = {}
  let body: BodyInit | undefined

  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(form).toString()
  }

  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(path, { method, headers, body, signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new HttpError(0, 'Network error', 'Could not reach the server.')
  }

  if (res.status === 401) {
    clearToken()
    onUnauthorized?.()
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    throw new HttpError(res.status, res.statusText, parseErrorDetail(data))
  }
  return data as T
}

// -----------------------------------------------------------------------------
// Endpoints
// -----------------------------------------------------------------------------

export function getStatus(): Promise<StatusInfo> {
  return apiFetch<StatusInfo>('/status', { auth: false })
}

export function login(
  username: string,
  password: string,
  rememberMe: boolean,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/token', {
    method: 'POST',
    auth: false,
    form: {
      username,
      password,
      remember_me: rememberMe ? 'true' : 'false',
    },
  })
}

export function getMe(): Promise<AuthenticatedUser> {
  return apiFetch<AuthenticatedUser>('/auth/me')
}

// --- Services -----------------------------------------------------------------

export function listServices(): Promise<ServiceInfo[]> {
  return apiFetch<ServiceInfo[]>('/service/get-service-list')
}

export function createService(body: ServiceInfo): Promise<ServiceInfo> {
  return apiFetch<ServiceInfo>('/service/create', { method: 'POST', json: body })
}

export function editService(
  name: string,
  body: ServiceEditPayload,
): Promise<ServiceInfo> {
  return apiFetch<ServiceInfo>(`/service/edit/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    json: body,
  })
}

export function deleteService(name: string): Promise<DeleteServiceResponse> {
  return apiFetch<DeleteServiceResponse>(`/service/delete/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

// --- Pending ------------------------------------------------------------------

export function listPending(): Promise<PendingConnection[]> {
  return apiFetch<PendingConnection[]>('/pending/get-pending-connections')
}

export function acceptPending(id: string): Promise<AcceptPendingResponse> {
  return apiFetch<AcceptPendingResponse>(`/pending/accept/${encodeURIComponent(id)}`, {
    method: 'POST',
  })
}

export function denyPending(
  id: string,
  ignoreConnection: boolean,
): Promise<DenyPendingResponse> {
  return apiFetch<DenyPendingResponse>(`/pending/deny/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    json: { ignore_connection: ignoreConnection },
  })
}

// --- Connections --------------------------------------------------------------

export function listConnections(): Promise<AllowedConnection[]> {
  return apiFetch<AllowedConnection[]>('/connection/get-connection-list')
}

export function revokeConnection(id: string): Promise<AllowedConnection> {
  return apiFetch<AllowedConnection>(`/connection/revoke/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function listIgnored(): Promise<DeniedConnection[]> {
  return apiFetch<DeniedConnection[]>('/connection/ignored/get-ignored-list')
}

export function removeIgnored(id: string): Promise<DeniedConnection> {
  return apiFetch<DeniedConnection>(
    `/connection/ignored/remove/${encodeURIComponent(id)}`,
    { method: 'POST' },
  )
}

// --- Webhooks -----------------------------------------------------------------

export function listWebhooks(): Promise<Webhook[]> {
  return apiFetch<Webhook[]>('/webhook/get-webhook-list')
}

export function addWebhook(body: Webhook): Promise<CreateWebhookResponse> {
  return apiFetch<CreateWebhookResponse>('/webhook/add-webhook', {
    method: 'POST',
    json: body,
  })
}

export function modifyWebhook(body: WebhookModifyPayload): Promise<ModifyWebhookResponse> {
  return apiFetch<ModifyWebhookResponse>('/webhook/modify-webhook', {
    method: 'PATCH',
    json: body,
  })
}

export function removeWebhook(event: WebhookEvent): Promise<DeleteWebhookResponse> {
  return apiFetch<DeleteWebhookResponse>('/webhook/remove-webhook', {
    method: 'DELETE',
    json: { event },
  })
}
