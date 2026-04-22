import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  HttpError,
  acceptPending,
  denyPending,
  listPending,
  primaryEmail,
  primaryPhone,
  type PendingConnection,
} from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ContactCell } from '../components/ContactCell'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { usePersistedPageSize } from '../components/pagination-utils'
import { ClockIcon, PinIcon, RefreshIcon, SearchIcon } from '../icons'
import type { Messages } from '../i18n'
import type { Lang } from '../i18n'
import { fmt, formatMinutes } from '../format'

type PendingViewProps = {
  t: Messages
  lang: Lang
  onPendingChanged?: () => void
}

function matchesQuery(p: PendingConnection, q: string): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  if (String(p.ip_address).toLowerCase().includes(n)) return true
  if (p.service?.name?.toLowerCase().includes(n)) return true
  if (p.contact_methods?.name?.toLowerCase().includes(n)) return true
  const email = primaryEmail(p.contact_methods)
  if (email && email.toLowerCase().includes(n)) return true
  const phone = primaryPhone(p.contact_methods)
  if (phone && phone.toLowerCase().includes(n)) return true
  if (p.notes?.toLowerCase().includes(n)) return true
  return false
}

export function PendingView({ t, lang: _lang, onPendingChanged }: PendingViewProps) {
  void _lang
  const [items, setItems] = useState<PendingConnection[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  const [toAccept, setToAccept] = useState<PendingConnection | null>(null)
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

  const performAccept = async () => {
    if (!toAccept?._id) return
    await acceptPending(toAccept._id)
    setToAccept(null)
    await refresh()
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
                    key={p._id ?? `${p.ip_address}-${p.service?.name ?? ''}`}
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

      <ConfirmDialog
        open={!!toAccept}
        title={t.accept}
        labelConfirm={t.accept}
        labelBusy={t.loading}
        labelCancel={t.cancel}
        labelClose={t.close}
        onConfirm={performAccept}
        onClose={() => setToAccept(null)}
      >
        {toAccept ? (
          <>
            <p>{t.pendingAcceptConfirm}</p>
            <div className="confirm-facts">
              <FactRow label={t.colIp} value={String(toAccept.ip_address)} mono />
              <FactRow label={t.colService} value={toAccept.service?.name ?? '—'} />
              <FactRow label={t.colExpiry} value={formatMinutes(toAccept.service?.expiry, t)} />
            </div>
          </>
        ) : null}
      </ConfirmDialog>

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
            <p>{fmt(t.pendingDenyPrompt, { name: toDeny.service?.name ?? '—' })}</p>
            <div className="confirm-facts">
              <FactRow label={t.colIp} value={String(toDeny.ip_address)} mono />
              <FactRow label={t.colService} value={toDeny.service?.name ?? '—'} />
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
          {p.service?.name ? (
            <span className="record-card-service">{p.service.name}</span>
          ) : null}
        </div>
        <div className="record-card-actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
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
