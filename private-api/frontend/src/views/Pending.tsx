import { useCallback, useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import {
  HttpError,
  acceptPending,
  denyPending,
  listPending,
  listServices,
  primaryEmail,
  primaryPhone,
  type AcceptPendingBody,
  type PendingConnection,
  type ServiceInfo,
} from '../api'
import { ContactCell } from '../components/ContactCell'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { usePersistedPageSize } from '../components/pagination-utils'
import { ClockIcon, PinIcon, RefreshIcon, SearchIcon, CalendarIcon } from '../icons'
import type { Messages } from '../i18n'
import type { Lang } from '../i18n'
import { fmt, formatMinutes, formatRelativeTime } from '../format'
import { parseDatetimeLocalToDate, toDatetimeLocalValue } from '../datetime-local'

function pendingServiceLabel(s: PendingConnection['service']): string {
  if (!s) return '—'
  const n = s.name
  if (typeof n === 'string' && n.trim() !== '') return n.trim()
  return '—'
}

function catalogServiceName(s: ServiceInfo): string {
  const n = typeof s.name === 'string' ? s.name.trim() : ''
  if (n) return n
  return String(s.internal_address ?? '').trim()
}

type AcceptDraft = {
  service_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  expiry_mode: 'inherit' | 'none' | 'at'
  access_until_local: string
}

type PendingViewProps = {
  t: Messages
  lang: Lang
  onPendingChanged?: () => void
}

function matchesQuery(p: PendingConnection, q: string): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  if (String(p.ip_address).toLowerCase().includes(n)) return true
  if (pendingServiceLabel(p.service).toLowerCase().includes(n)) return true
  if (p.contact_methods?.name?.toLowerCase().includes(n)) return true
  const email = primaryEmail(p.contact_methods)
  if (email && email.toLowerCase().includes(n)) return true
  const phone = primaryPhone(p.contact_methods)
  if (phone && phone.toLowerCase().includes(n)) return true
  if (p.notes?.toLowerCase().includes(n)) return true
  return false
}

export function PendingView({ t, lang, onPendingChanged }: PendingViewProps) {
  const [items, setItems] = useState<PendingConnection[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  const [toAccept, setToAccept] = useState<PendingConnection | null>(null)
  const [acceptCatalog, setAcceptCatalog] = useState<ServiceInfo[] | null>(null)
  const [acceptDraft, setAcceptDraft] = useState<AcceptDraft | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [acceptSubmitting, setAcceptSubmitting] = useState(false)

  const [toDeny, setToDeny] = useState<PendingConnection | null>(null)
  const [denyIgnore, setDenyIgnore] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePersistedPageSize('rpacm-admin-pending-size', 10)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await listPending()
      setItems(list)
      onPendingChanged?.()
    } catch (e) {
      setLoadError(e instanceof HttpError ? e.detail || e.message : t.errLoadFailed)
    } finally {
      setLoading(false)
    }
  }, [t.errLoadFailed, onPendingChanged])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadAcceptCatalog = useCallback(async () => {
    setAcceptCatalog(null)
    try {
      const list = await listServices()
      setAcceptCatalog(list.filter((s) => catalogServiceName(s)))
    } catch {
      setAcceptCatalog([])
    }
  }, [])

  useEffect(() => {
    if (!toAccept) {
      setAcceptDraft(null)
      setAcceptError(null)
      return
    }
    const svc = pendingServiceLabel(toAccept.service)
    const expM = toAccept.service?.expiry ?? null
    let expiry_mode: AcceptDraft['expiry_mode'] = 'inherit'
    let access_until_local = ''
    if (expM == null) {
      expiry_mode = 'none'
    }
    setAcceptDraft({
      service_name: svc !== '—' ? svc : '',
      contact_name: (toAccept.contact_methods?.name ?? '').trim(),
      contact_email: (primaryEmail(toAccept.contact_methods) ?? '').trim(),
      contact_phone: (primaryPhone(toAccept.contact_methods) ?? '').trim(),
      expiry_mode,
      access_until_local,
    })
    void loadAcceptCatalog()
  }, [toAccept, loadAcceptCatalog])

  const acceptAccessSummary = useMemo(() => {
    if (!acceptDraft || acceptDraft.expiry_mode !== 'at') return null
    const s = acceptDraft.access_until_local.trim()
    if (!s) return null
    const end = parseDatetimeLocalToDate(s)
    if (!end || end.getTime() <= Date.now()) return null
    return fmt(t.accessUntilAfterApproval, { relative: formatRelativeTime(end, lang) })
  }, [acceptDraft, t, lang])

  const filtered = useMemo(() => {
    if (!items) return []
    return items.filter((p) => matchesQuery(p, query))
  }, [items, query])

  const onQueryChange = (q: string) => {
    setQuery(q)
    setPage(1)
  }

  const pageItems = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  )

  const closeAcceptModal = () => {
    if (acceptSubmitting) return
    setToAccept(null)
  }

  const setExpiryMode = (mode: AcceptDraft['expiry_mode']) => {
    setAcceptDraft((d) => {
      if (!d) return d
      const next = { ...d, expiry_mode: mode }
      if (mode === 'at' && !next.access_until_local.trim()) {
        next.access_until_local = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000))
      }
      return next
    })
  }

  const submitAccept = async (e: FormEvent) => {
    e.preventDefault()
    if (!toAccept?._id || !acceptDraft) return
    setAcceptError(null)
    const svc = acceptDraft.service_name.trim()
    if (!svc) {
      setAcceptError(t.errPendingServiceRequired)
      return
    }
    if (acceptDraft.expiry_mode === 'at') {
      const raw = acceptDraft.access_until_local.trim()
      if (!raw) {
        setAcceptError(t.errAccessUntilPast)
        return
      }
      const end = parseDatetimeLocalToDate(raw)
      if (!end || end.getTime() <= Date.now()) {
        setAcceptError(t.errAccessUntilPast)
        return
      }
    }

    const mergedName =
      acceptDraft.contact_name.trim() ||
      (toAccept.contact_methods?.name ?? '').trim() ||
      null
    const mergedEmail =
      acceptDraft.contact_email.trim() ||
      (primaryEmail(toAccept.contact_methods) ?? '').trim() ||
      null
    const mergedPhone =
      acceptDraft.contact_phone.trim() ||
      (primaryPhone(toAccept.contact_methods) ?? '').trim() ||
      null

    const body: AcceptPendingBody = {
      explicit: true,
      service_name: svc,
      contact_name: mergedName,
      contact_email: mergedEmail,
      contact_phone: mergedPhone,
      expiry_mode: acceptDraft.expiry_mode,
      expire_at:
        acceptDraft.expiry_mode === 'at'
          ? (() => {
              const end = parseDatetimeLocalToDate(acceptDraft.access_until_local.trim())
              return end ? end.toISOString() : null
            })()
          : null,
    }

    setAcceptSubmitting(true)
    try {
      await acceptPending(toAccept._id, body)
      setToAccept(null)
      await refresh()
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 409) setAcceptError(t.errPendingDuplicate)
        else setAcceptError(err.detail || err.message)
      } else {
        setAcceptError(t.errGeneric)
      }
    } finally {
      setAcceptSubmitting(false)
    }
  }

  const performDeny = async () => {
    if (!toDeny?._id) return
    await denyPending(toDeny._id, denyIgnore)
    setToDeny(null)
    setDenyIgnore(false)
    await refresh()
  }

  // Shift-click skips the confirmation dialog entirely. For Deny we also
  // skip the "block this IP" option since the user opted out of seeing it.
  const onAcceptClick = async (e: MouseEvent<HTMLButtonElement>, p: PendingConnection) => {
    if (e.shiftKey && p._id) {
      await acceptPending(p._id)
      await refresh()
      return
    }
    setToAccept(p)
  }

  const onDenyClick = async (e: MouseEvent<HTMLButtonElement>, p: PendingConnection) => {
    if (e.shiftKey && p._id) {
      await denyPending(p._id, false)
      await refresh()
      return
    }
    setToDeny(p)
    setDenyIgnore(false)
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1 className="view-title">{t.pendingTitle}</h1>
          <p className="view-lede">{t.pendingLede}</p>
        </div>
        <div className="view-head-actions">
          <button type="button" className="btn btn--quiet btn--sm" onClick={refresh}>
            <RefreshIcon width={14} height={14} />
            <span>{t.refresh}</span>
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-input-wrap">
          <SearchIcon width={14} height={14} className="search-input-icon" />
          <input
            className="input search-input"
            type="search"
            placeholder={t.search}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
      </div>

      {loadError ? (
        <div className="feedback error" role="alert">
          {loadError}
        </div>
      ) : null}

      {items === null && loading ? (
        <p className="muted">{t.loading}</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClockIcon width={28} height={28} />}
          message={query ? t.noMatch : t.pendingEmpty}
        />
      ) : (
        (() => {
          const paginationProps = {
            total: filtered.length,
            page,
            pageSize,
            onPage: setPage,
            onPageSize: (n: number) => {
              setPageSize(n)
              setPage(1)
            },
            t,
          }
          return (
            <>
              <Pagination {...paginationProps} variant="top" />
              <div className="card-list">
                {pageItems.map((p) => (
                  <PendingCard
                    key={p._id ?? `${p.ip_address}-${pendingServiceLabel(p.service)}`}
                    p={p}
                    t={t}
                    onAccept={(e) => void onAcceptClick(e, p)}
                    onDeny={(e) => void onDenyClick(e, p)}
                  />
                ))}
              </div>
              <Pagination {...paginationProps} variant="bottom" />
            </>
          )
        })()
      )}

      <Modal
        open={!!toAccept}
        onClose={closeAcceptModal}
        title={t.accept}
        labelClose={t.close}
        size="md"
        busy={acceptSubmitting}
        footer={
          <>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={closeAcceptModal}
              disabled={acceptSubmitting}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              form="accept-pending-form"
              className="btn btn--accept"
              disabled={
                acceptSubmitting ||
                acceptCatalog === null ||
                acceptCatalog.length === 0 ||
                !acceptDraft
              }
            >
              {acceptSubmitting ? t.loading : t.accept}
            </button>
          </>
        }
      >
        {toAccept && acceptDraft ? (
          <>
            <p className="modal-lede">{t.pendingAcceptConfirm}</p>
            <div className="confirm-facts">
              <FactRow label={t.colIp} value={String(toAccept.ip_address)} mono />
              <FactRow
                label={t.colExpiry}
                value={formatMinutes(toAccept.service?.expiry, t)}
              />
            </div>
            <form id="accept-pending-form" className="stack" onSubmit={(e) => void submitAccept(e)}>
              <h3 className="form-section-title">{t.pendingAcceptSectionDetails}</h3>
              <div className="field">
                <label htmlFor="accept-svc" className="label-row">
                  {t.pendingAcceptServiceLabel}
                  <span className="required-mark">*</span>
                </label>
                <select
                  id="accept-svc"
                  className="input"
                  value={acceptDraft.service_name}
                  onChange={(e) =>
                    setAcceptDraft({ ...acceptDraft, service_name: e.target.value })
                  }
                  disabled={
                    acceptSubmitting || acceptCatalog === null || acceptCatalog.length === 0
                  }
                  required
                >
                  <option value="">{t.connectionsAddServicePlaceholder}</option>
                  {(acceptCatalog ?? []).map((s, idx) => {
                    const v = catalogServiceName(s)
                    return (
                      <option key={`${v}-${idx}`} value={v}>
                        {v}
                      </option>
                    )
                  })}
                </select>
              </div>
              <p className="field-hint">{t.pendingAcceptContactHint}</p>
              <div className="field">
                <label htmlFor="accept-cname" className="label-row">
                  {t.connectionsAddContactNameLabel}
                  <span className="optional-mark">{t.optional}</span>
                </label>
                <input
                  id="accept-cname"
                  className="input"
                  maxLength={32}
                  value={acceptDraft.contact_name}
                  onChange={(e) =>
                    setAcceptDraft({ ...acceptDraft, contact_name: e.target.value })
                  }
                  disabled={acceptSubmitting}
                />
              </div>
              <div className="field">
                <label htmlFor="accept-cemail" className="label-row">
                  {t.connectionsAddContactEmailLabel}
                  <span className="optional-mark">{t.optional}</span>
                </label>
                <input
                  id="accept-cemail"
                  className="input"
                  type="email"
                  inputMode="email"
                  value={acceptDraft.contact_email}
                  onChange={(e) =>
                    setAcceptDraft({ ...acceptDraft, contact_email: e.target.value })
                  }
                  disabled={acceptSubmitting}
                />
              </div>
              <div className="field">
                <label htmlFor="accept-cphone" className="label-row">
                  {t.connectionsAddContactPhoneLabel}
                  <span className="optional-mark">{t.optional}</span>
                </label>
                <input
                  id="accept-cphone"
                  className="input"
                  value={acceptDraft.contact_phone}
                  onChange={(e) =>
                    setAcceptDraft({ ...acceptDraft, contact_phone: e.target.value })
                  }
                  disabled={acceptSubmitting}
                />
              </div>
              <div className="field">
                <span className="label-row">{t.colExpiry}</span>
                <div className="radio-stack" role="radiogroup" aria-label={t.colExpiry}>
                  <label className="radio-row">
                    <input
                      type="radio"
                      name="accept-expiry"
                      checked={acceptDraft.expiry_mode === 'inherit'}
                      onChange={() => setExpiryMode('inherit')}
                      disabled={acceptSubmitting}
                    />
                    <span>{t.pendingAcceptExpiryInherit}</span>
                  </label>
                  <label className="radio-row">
                    <input
                      type="radio"
                      name="accept-expiry"
                      checked={acceptDraft.expiry_mode === 'none'}
                      onChange={() => setExpiryMode('none')}
                      disabled={acceptSubmitting}
                    />
                    <span>{t.pendingAcceptExpiryNone}</span>
                  </label>
                  <label className="radio-row">
                    <input
                      type="radio"
                      name="accept-expiry"
                      checked={acceptDraft.expiry_mode === 'at'}
                      onChange={() => setExpiryMode('at')}
                      disabled={acceptSubmitting}
                    />
                    <span>{t.pendingAcceptExpiryAt}</span>
                  </label>
                </div>
              </div>
              {acceptDraft.expiry_mode === 'at' ? (
                <div className="field">
                  <label htmlFor="accept-until" className="label-row">
                    <CalendarIcon width={14} height={14} className="label-icon" />
                    {t.accessUntilLabel}
                    <span className="optional-mark">{t.optional}</span>
                  </label>
                  <input
                    id="accept-until"
                    className="input input-datetime-local"
                    type="datetime-local"
                    min={toDatetimeLocalValue(new Date())}
                    step={60}
                    value={acceptDraft.access_until_local}
                    onChange={(e) =>
                      setAcceptDraft({ ...acceptDraft, access_until_local: e.target.value })
                    }
                    disabled={acceptSubmitting}
                  />
                  {acceptAccessSummary ? (
                    <div className="access-until-embed" role="status">
                      <p className="access-until-embed__text">{acceptAccessSummary}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {acceptCatalog && acceptCatalog.length === 0 ? (
                <p className="field-hint">{t.connectionsNoServicesHint}</p>
              ) : null}
              {acceptError ? (
                <div className="feedback error" role="alert">
                  {acceptError}
                </div>
              ) : null}
            </form>
          </>
        ) : null}
      </Modal>

      <Modal
        open={!!toDeny}
        onClose={() => {
          setToDeny(null)
          setDenyIgnore(false)
        }}
        title={t.pendingDenyTitle}
        labelClose={t.close}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => {
                setToDeny(null)
                setDenyIgnore(false)
              }}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void performDeny()}
            >
              {t.deny}
            </button>
          </>
        }
      >
        {toDeny ? (
          <div className="stack">
            <p>{fmt(t.pendingDenyPrompt, { name: pendingServiceLabel(toDeny.service) })}</p>
            <div className="confirm-facts">
              <FactRow label={t.colIp} value={String(toDeny.ip_address)} mono />
              <FactRow label={t.colService} value={pendingServiceLabel(toDeny.service)} />
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={denyIgnore}
                onChange={(e) => setDenyIgnore(e.target.checked)}
              />
              <span className="checkbox-row-text">
                <span>{t.pendingDenyIgnoreLabel}</span>
                <span className="field-hint">{t.pendingDenyIgnoreHint}</span>
              </span>
            </label>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function PendingCard({
  p,
  t,
  onAccept,
  onDeny,
}: {
  p: PendingConnection
  t: Messages
  onAccept: (e: MouseEvent<HTMLButtonElement>) => void
  onDeny: (e: MouseEvent<HTMLButtonElement>) => void
}) {
  const lat = p.location?.lat
  const lon = p.location?.lon
  const hasLocation = lat != null && lon != null
  const mapsUrl = hasLocation
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
    : null
  return (
    <article className="record-card">
      <header className="record-card-head">
        <div className="record-card-title">
          <span className="ip-chip mono">{String(p.ip_address)}</span>
          {pendingServiceLabel(p.service) !== '—' ? (
            <span className="record-card-service">{pendingServiceLabel(p.service)}</span>
          ) : null}
        </div>
        <div className="record-card-actions">
          <button
            type="button"
            className="btn btn--accept btn--sm"
            onClick={onAccept}
            title={t.shiftSkipAccept}
          >
            {t.accept}
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={onDeny}
            title={t.shiftSkipDeny}
          >
            {t.deny}
          </button>
        </div>
      </header>
      <div className="record-card-grid">
        <div className="record-card-field">
          <span className="record-card-label">{t.colContact}</span>
          <ContactCell contact={p.contact_methods} t={t} />
        </div>
        <div className="record-card-field">
          <span className="record-card-label">{t.colExpiry}</span>
          <span>{formatMinutes(p.service?.expiry, t)}</span>
        </div>
        <div className="record-card-field">
          <span className="record-card-label">{t.colLocation}</span>
          {hasLocation ? (
            <a
              className="contact-link"
              href={mapsUrl!}
              target="_blank"
              rel="noopener noreferrer"
            >
              <PinIcon width={12} height={12} />
              <span className="mono">
                {Number(lat).toFixed(4)}, {Number(lon).toFixed(4)}
              </span>
              <span className="maps-link-note">({t.openInMaps})</span>
            </a>
          ) : (
            <span className="muted">{t.locationNotShared}</span>
          )}
        </div>
        {p.notes ? (
          <div className="record-card-field record-card-field--full">
            <span className="record-card-label">{t.colNotes}</span>
            <span className="record-card-notes">{p.notes}</span>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function FactRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="fact-row">
      <span className="fact-row-label">{label}</span>
      <span className={'fact-row-value' + (mono ? ' mono' : '')}>{value}</span>
    </div>
  )
}
