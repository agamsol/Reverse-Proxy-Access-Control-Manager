import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  HTTP_METHODS,
  HttpError,
  WEBHOOK_EVENTS,
  addWebhook,
  listWebhooks,
  modifyWebhook,
  removeWebhook,
  type HttpMethod,
  type Webhook,
  type WebhookEvent,
} from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import {
  BookIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
  WebhookIcon,
  XIcon,
} from '../icons'

const TEMPLATES_URL =
  'https://github.com/agamsol/Reverse-Proxy-Access-Control-Manager/tree/main/webhook-templates'
const TEMPLATE_DOCS_URL =
  'https://github.com/agamsol/Reverse-Proxy-Access-Control-Manager/blob/main/webhook-templates/template_options.md'
import type { Messages } from '../i18n'
import { fmt } from '../format'

type WebhooksViewProps = {
  t: Messages
}

type KV = { key: string; value: string }

type WebhookDraft = {
  event: WebhookEvent
  method: HttpMethod
  url: string
  headers: KV[]
  query_params: KV[]
  cookies: KV[]
  body: string
}

type TestState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'success'; level: 'success' | 'info'; message: string }
  | { status: 'error'; message: string }

function eventLabel(e: WebhookEvent, t: Messages): string {
  switch (e) {
    case 'pending.new':
      return t.eventPendingNew
    case 'pending.accepted':
      return t.eventPendingAccepted
    case 'pending.denied':
      return t.eventPendingDenied
    case 'connection.revoked':
      return t.eventConnectionRevoked
  }
}

// Human-readable description pulled from the public template_options docs
// so admins can see at a glance what fires each webhook.
function eventDescription(e: WebhookEvent, t: Messages): string {
  switch (e) {
    case 'pending.new':
      return t.eventPendingNewDesc
    case 'pending.accepted':
      return t.eventPendingAcceptedDesc
    case 'pending.denied':
      return t.eventPendingDeniedDesc
    case 'connection.revoked':
      return t.eventConnectionRevokedDesc
  }
}

function recordToRows(v: Record<string, unknown> | null | undefined): KV[] {
  if (!v) return []
  return Object.entries(v).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : String(value ?? ''),
  }))
}

function rowsToRecord(rows: KV[]): Record<string, string> | null {
  const out: Record<string, string> = {}
  for (const { key, value } of rows) {
    const k = key.trim()
    if (!k) continue
    out[k] = value
  }
  return Object.keys(out).length === 0 ? null : out
}

function jsonFieldToDraft(value: Record<string, unknown> | null | undefined): string {
  if (value == null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function toDraft(w?: Webhook): WebhookDraft {
  return {
    event: w?.event ?? 'pending.new',
    method: w?.method ?? 'POST',
    url: w?.url ?? '',
    headers: recordToRows(w?.headers),
    query_params: recordToRows(w?.query_params),
    cookies: recordToRows(w?.cookies),
    body: jsonFieldToDraft(w?.body ?? null),
  }
}

type ParseResult =
  | { ok: true; value: Record<string, unknown> | null }
  | { ok: false }

function parseJsonField(raw: string): ParseResult {
  const s = raw.trim()
  if (!s) return { ok: true, value: null }
  try {
    const parsed = JSON.parse(s)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, value: parsed as Record<string, unknown> }
    }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

type TestTarget = {
  method: HttpMethod
  url: string
  headers: Record<string, unknown> | null
  query_params: Record<string, unknown> | null
  body: Record<string, unknown> | null
}

function stringifyEntry(v: unknown): string {
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return ''
  return String(v)
}

// Best-effort browser dispatch of a webhook for connectivity testing.
// Cookies cannot be set by the browser, so they are intentionally skipped.
async function sendTestWebhook(target: TestTarget, t: Messages): Promise<TestState> {
  let url: URL
  try {
    url = new URL(target.url)
  } catch {
    return { status: 'error', message: t.webhookTestInvalidUrl }
  }

  for (const [k, v] of Object.entries(target.query_params ?? {})) {
    url.searchParams.set(k, stringifyEntry(v))
  }

  const headers = new Headers()
  for (const [k, v] of Object.entries(target.headers ?? {})) {
    try {
      headers.set(k, stringifyEntry(v))
    } catch {
      // Forbidden header names (e.g. Host) are silently ignored.
    }
  }

  const hasBody =
    target.body !== null && Object.keys(target.body ?? {}).length > 0
  const methodAllowsBody =
    target.method !== 'GET' && target.method !== 'HEAD'

  let body: BodyInit | undefined
  if (hasBody && methodAllowsBody) {
    body = JSON.stringify(target.body)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
  }

  try {
    const res = await fetch(url.toString(), {
      method: target.method,
      headers,
      body,
      mode: 'cors',
    })
    if (res.type === 'opaque' || res.type === 'opaqueredirect') {
      return { status: 'success', level: 'info', message: t.webhookTestOpaque }
    }
    return {
      status: 'success',
      level: res.ok ? 'success' : 'info',
      message: fmt(t.webhookTestSuccess, {
        status: String(res.status),
        statusText: res.statusText || '',
      }).trim(),
    }
  } catch {
    return { status: 'error', message: t.webhookTestNetworkError }
  }
}

export function WebhooksView({ t }: WebhooksViewProps) {
  const [items, setItems] = useState<Webhook[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Webhook | null>(null)
  const [draft, setDraft] = useState<WebhookDraft>(toDraft())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formTest, setFormTest] = useState<TestState>({ status: 'idle' })

  const [toDelete, setToDelete] = useState<Webhook | null>(null)

  // Per-card inline test state (event -> TestState).
  const [cardTests, setCardTests] = useState<Record<string, TestState>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await listWebhooks()
      setItems(list)
    } catch (e) {
      setLoadError(e instanceof HttpError ? e.detail || e.message : t.errLoadFailed)
    } finally {
      setLoading(false)
    }
  }, [t.errLoadFailed])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const takenEvents = useMemo(() => {
    const s = new Set<WebhookEvent>()
    for (const w of items ?? []) s.add(w.event)
    return s
  }, [items])

  const availableEvents = useMemo(() => {
    return WEBHOOK_EVENTS.filter((e) => !takenEvents.has(e))
  }, [takenEvents])

  const openCreate = () => {
    const firstFree = availableEvents[0] ?? 'pending.new'
    setEditing(null)
    setDraft({ ...toDraft(), event: firstFree })
    setFormError(null)
    setFormTest({ status: 'idle' })
    setFormOpen(true)
  }

  const openEdit = (w: Webhook) => {
    setEditing(w)
    setDraft(toDraft(w))
    setFormError(null)
    setFormTest({ status: 'idle' })
    setFormOpen(true)
  }

  const closeForm = () => {
    if (submitting) return
    setFormOpen(false)
  }

  // Parse the current draft into an API-ready payload (or null on JSON error).
  const parseDraft = useCallback(
    (d: WebhookDraft): { payload: TestTarget; bodyRecord: Record<string, unknown> | null } | null => {
      const r = parseJsonField(d.body)
      if (!r.ok) {
        setFormError(fmt(t.errWebhookInvalidJson, { field: t.webhookBodyLabel }))
        return null
      }
      return {
        payload: {
          method: d.method,
          url: d.url.trim(),
          headers: rowsToRecord(d.headers),
          query_params: rowsToRecord(d.query_params),
          body: r.value,
        },
        bodyRecord: r.value,
      }
    },
    [t],
  )

  const submitForm = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!draft.url.trim()) {
      setFormError(t.errWebhookUrlRequired)
      return
    }

    const parsed = parseDraft(draft)
    if (!parsed) return

    setSubmitting(true)
    try {
      if (editing) {
        await modifyWebhook({
          event: editing.event,
          method: draft.method !== editing.method ? draft.method : null,
          url: draft.url.trim() !== editing.url ? draft.url.trim() : null,
          headers: parsed.payload.headers,
          query_params: parsed.payload.query_params,
          cookies: rowsToRecord(draft.cookies),
          body: parsed.bodyRecord,
        })
      } else {
        await addWebhook({
          event: draft.event,
          method: draft.method,
          url: draft.url.trim(),
          headers: parsed.payload.headers,
          query_params: parsed.payload.query_params,
          cookies: rowsToRecord(draft.cookies),
          body: parsed.bodyRecord,
        })
      }
      setFormOpen(false)
      await refresh()
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 409) setFormError(t.errWebhookEventTaken)
        else if (err.status === 404) setFormError(t.errWebhookEventMissing)
        else setFormError(err.detail || err.message)
      } else {
        setFormError(t.errGeneric)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const testDraft = async () => {
    setFormError(null)
    if (!draft.url.trim()) {
      setFormError(t.errWebhookUrlRequired)
      return
    }
    const parsed = parseDraft(draft)
    if (!parsed) return
    setFormTest({ status: 'running' })
    const result = await sendTestWebhook(parsed.payload, t)
    setFormTest(result)
  }

  const testExisting = async (w: Webhook) => {
    setCardTests((m) => ({ ...m, [w.event]: { status: 'running' } }))
    const result = await sendTestWebhook(
      {
        method: w.method,
        url: w.url,
        headers: w.headers ?? null,
        query_params: w.query_params ?? null,
        body: w.body ?? null,
      },
      t,
    )
    setCardTests((m) => ({ ...m, [w.event]: result }))
  }

  const performDelete = async () => {
    if (!toDelete) return
    await removeWebhook(toDelete.event)
    setToDelete(null)
    await refresh()
  }

  const canCreate = availableEvents.length > 0

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1 className="view-title">{t.webhooksTitle}</h1>
          <p className="view-lede">{t.webhooksLede}</p>
        </div>
        <div className="view-head-actions">
          <button type="button" className="btn btn--quiet btn--sm" onClick={refresh}>
            <RefreshIcon width={14} height={14} />
            <span>{t.refresh}</span>
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={openCreate}
            disabled={!canCreate}
          >
            <PlusIcon width={14} height={14} />
            <span>{t.webhooksNewBtn}</span>
          </button>
        </div>
      </div>

      <aside className="template-links" aria-labelledby="webhook-templates-heading">
        <div className="template-links-text">
          <h2 id="webhook-templates-heading" className="template-links-title">
            {t.webhookTemplatesHeading}
          </h2>
          <p className="template-links-intro">{t.webhookTemplatesIntro}</p>
        </div>
        <div className="template-links-actions">
          <a
            className="template-link"
            href={TEMPLATES_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLinkIcon width={14} height={14} aria-hidden />
            <span>{t.webhookTemplatesBrowse}</span>
          </a>
          <a
            className="template-link"
            href={TEMPLATE_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookIcon width={14} height={14} aria-hidden />
            <span>{t.webhookTemplatesVariables}</span>
          </a>
        </div>
      </aside>

      {loadError ? (
        <div className="feedback error" role="alert">
          {loadError}
        </div>
      ) : null}

      {items === null && loading ? (
        <p className="muted">{t.loading}</p>
      ) : items && items.length === 0 ? (
        <EmptyState
          icon={<WebhookIcon width={28} height={28} />}
          message={t.webhooksEmpty}
        />
      ) : (
        <div className="webhook-list">
          {(items ?? []).map((w) => {
            const testState = cardTests[w.event] ?? { status: 'idle' }
            return (
              <article key={w.event} className="webhook-card">
                <header className="webhook-card-head">
                  <div className="webhook-card-title">
                    <div className="webhook-card-title-row">
                      <span className="event-chip">{eventLabel(w.event, t)}</span>
                      <code className="webhook-card-slug">{w.event}</code>
                    </div>
                    <p className="webhook-card-desc">
                      {eventDescription(w.event, t)}
                    </p>
                  </div>
                  <div className="webhook-card-actions">
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      onClick={() => void testExisting(w)}
                      disabled={testState.status === 'running'}
                      title={t.webhookTest}
                    >
                      <RefreshIcon width={14} height={14} />
                      <span>
                        {testState.status === 'running' ? t.webhookTesting : t.webhookTest}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => openEdit(w)}
                      aria-label={t.edit}
                      title={t.edit}
                    >
                      <PencilIcon width={14} height={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => setToDelete(w)}
                      aria-label={t.delete}
                      title={t.delete}
                    >
                      <TrashIcon width={14} height={14} />
                    </button>
                  </div>
                </header>

                <div className="webhook-request-line">
                  <span
                    className={`method-chip method-chip--${w.method.toLowerCase()} mono`}
                  >
                    {w.method}
                  </span>
                  <span className="webhook-request-url mono">{w.url}</span>
                </div>

                <WebhookKvSection
                  label={t.webhookHeadersLabel}
                  value={w.headers}
                />
                <WebhookKvSection
                  label={t.webhookQueryLabel}
                  value={w.query_params}
                />
                <WebhookKvSection
                  label={t.webhookCookiesLabel}
                  value={w.cookies}
                />
                <WebhookBodySection
                  label={t.webhookBodyLabel}
                  value={w.body}
                />

                <TestFeedback state={testState} />
              </article>
            )
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? t.webhooksEditTitle : t.webhooksCreateTitle}
        labelClose={t.close}
        size="lg"
        busy={submitting}
        footer={
          <div className="modal-foot-group" style={{ width: '100%', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => void testDraft()}
              disabled={submitting || formTest.status === 'running' || !draft.url.trim()}
            >
              <RefreshIcon width={14} height={14} />
              <span>
                {formTest.status === 'running' ? t.webhookTesting : t.webhookTest}
              </span>
            </button>
            <div className="modal-foot-group">
              <button
                type="button"
                className="btn btn--quiet"
                onClick={closeForm}
                disabled={submitting}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                form="webhook-form"
                className="btn btn--primary"
                disabled={submitting || !draft.url.trim()}
              >
                {submitting ? (editing ? t.saving : t.creating) : editing ? t.save : t.create}
              </button>
            </div>
          </div>
        }
      >
        <form id="webhook-form" className="stack" onSubmit={submitForm}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="wh-event" className="label-row">
                {t.webhookEventLabel}
              </label>
              <select
                id="wh-event"
                className="input"
                value={draft.event}
                onChange={(e) =>
                  setDraft({ ...draft, event: e.target.value as WebhookEvent })
                }
                disabled={submitting || !!editing}
              >
                {WEBHOOK_EVENTS.map((ev) => {
                  const disabled = !editing && takenEvents.has(ev)
                  return (
                    <option key={ev} value={ev} disabled={disabled}>
                      {eventLabel(ev, t)} ({ev})
                      {disabled ? ' — ' + t.errWebhookEventTaken : ''}
                    </option>
                  )
                })}
              </select>
              <p className="field-hint">{eventDescription(draft.event, t)}</p>
            </div>
            <div className="field">
              <label htmlFor="wh-method" className="label-row">
                {t.webhookMethodLabel}
              </label>
              <select
                id="wh-method"
                className="input mono"
                value={draft.method}
                onChange={(e) =>
                  setDraft({ ...draft, method: e.target.value as HttpMethod })
                }
                disabled={submitting}
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="wh-url" className="label-row">
              {t.webhookUrlLabel}
              <span className="required-mark">*</span>
            </label>
            <input
              id="wh-url"
              className="input mono"
              type="url"
              required
              placeholder="https://example.com/hook"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              disabled={submitting}
            />
          </div>

          <KeyValueField
            label={t.webhookHeadersLabel}
            rows={draft.headers}
            onChange={(rows) => setDraft({ ...draft, headers: rows })}
            disabled={submitting}
            t={t}
          />
          <KeyValueField
            label={t.webhookQueryLabel}
            rows={draft.query_params}
            onChange={(rows) => setDraft({ ...draft, query_params: rows })}
            disabled={submitting}
            t={t}
          />
          <KeyValueField
            label={t.webhookCookiesLabel}
            rows={draft.cookies}
            onChange={(rows) => setDraft({ ...draft, cookies: rows })}
            disabled={submitting}
            t={t}
          />

          <div className="field">
            <label htmlFor="wh-body" className="label-row">
              {t.webhookBodyLabel}
            </label>
            <textarea
              id="wh-body"
              className="input mono textarea"
              rows={6}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              disabled={submitting}
              spellCheck={false}
              placeholder='{ "ip": "{{ ip }}" }'
            />
            <p className="field-hint">{t.webhookBodyHint}</p>
          </div>

          <TestFeedback state={formTest} />

          {formError ? (
            <div className="feedback error" role="alert">
              {formError}
            </div>
          ) : null}

          <p className="field-hint">{t.webhookTestNote}</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={t.webhooksDeleteTitle}
        labelConfirm={t.delete}
        labelBusy={t.deleting}
        labelCancel={t.cancel}
        labelClose={t.close}
        danger
        onConfirm={performDelete}
        onClose={() => setToDelete(null)}
      >
        {toDelete ? (
          <p>{fmt(t.webhooksDeletePrompt, { event: eventLabel(toDelete.event, t) })}</p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}

function KeyValueField({
  label,
  rows,
  onChange,
  disabled,
  t,
}: {
  label: string
  rows: KV[]
  onChange: (rows: KV[]) => void
  disabled?: boolean
  t: Messages
}) {
  const updateRow = (index: number, patch: Partial<KV>) => {
    const next = rows.slice()
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }
  const addRow = () => onChange([...rows, { key: '', value: '' }])
  const removeRow = (index: number) => {
    const next = rows.slice()
    next.splice(index, 1)
    onChange(next)
  }

  return (
    <div className="field kv-field">
      <span className="label-row">{label}</span>
      {rows.length === 0 ? (
        <div className="kv-empty">{t.webhookKvEmpty}</div>
      ) : (
        <div className="kv-rows">
          {rows.map((row, i) => (
            <div className="kv-row" key={i}>
              <input
                className="input mono"
                type="text"
                placeholder={t.webhookKvKey}
                value={row.key}
                onChange={(e) => updateRow(i, { key: e.target.value })}
                disabled={disabled}
                spellCheck={false}
                aria-label={`${label} — ${t.webhookKvKey}`}
              />
              <input
                className="input mono kv-value-col"
                type="text"
                placeholder={t.webhookKvValue}
                value={row.value}
                onChange={(e) => updateRow(i, { value: e.target.value })}
                disabled={disabled}
                spellCheck={false}
                aria-label={`${label} — ${t.webhookKvValue}`}
              />
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => removeRow(i)}
                disabled={disabled}
                aria-label={t.webhookKvRemove}
                title={t.webhookKvRemove}
              >
                <XIcon width={14} height={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className="btn btn--quiet btn--sm kv-add"
        onClick={addRow}
        disabled={disabled}
      >
        <PlusIcon width={14} height={14} />
        <span>{t.webhookKvAdd}</span>
      </button>
    </div>
  )
}

function TestFeedback({ state }: { state: TestState }): ReactNode {
  if (state.status === 'idle' || state.status === 'running') return null
  const cls =
    state.status === 'error'
      ? 'feedback error'
      : state.level === 'success'
      ? 'feedback success'
      : 'feedback info'
  return (
    <div className={cls} role="status">
      {state.message}
    </div>
  )
}

function WebhookKvSection({
  label,
  value,
}: {
  label: string
  value: Record<string, unknown> | null
}) {
  if (!value || Object.keys(value).length === 0) return null
  const entries = Object.entries(value)
  return (
    <section className="webhook-section">
      <header className="webhook-section-head">
        <span className="webhook-section-title">{label}</span>
        <span className="webhook-section-count">{entries.length}</span>
      </header>
      <dl className="webhook-kv-list mono">
        {entries.map(([k, v]) => (
          <div className="webhook-kv-row" key={k}>
            <dt className="webhook-kv-key">{k}</dt>
            <dd className="webhook-kv-value">
              {typeof v === 'string' ? v : JSON.stringify(v)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function WebhookBodySection({
  label,
  value,
}: {
  label: string
  value: Record<string, unknown> | null
}) {
  if (!value || Object.keys(value).length === 0) return null
  let pretty: string
  try {
    pretty = JSON.stringify(value, null, 2)
  } catch {
    pretty = String(value)
  }
  return (
    <section className="webhook-section">
      <header className="webhook-section-head">
        <span className="webhook-section-title">{label}</span>
        <span className="webhook-section-tag">JSON</span>
      </header>
      <pre className="webhook-code mono">{pretty}</pre>
    </section>
  )
}
