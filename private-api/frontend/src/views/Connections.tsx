import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  HttpError,
  listConnections,
  primaryEmail,
  primaryPhone,
  revokeConnection,
  type AllowedConnection,
} from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ContactCell } from '../components/ContactCell'
import { EmptyState } from '../components/EmptyState'
import { Pagination } from '../components/Pagination'
import { usePersistedPageSize } from '../components/pagination-utils'
import { RefreshIcon, SearchIcon, ShieldIcon } from '../icons'
import type { Lang, Messages } from '../i18n'
import { fmt, formatDateTime, formatRelativeTime } from '../format'

type ConnectionsViewProps = {
  t: Messages
  lang: Lang
}

function matchesQuery(c: AllowedConnection, q: string): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  if (String(c.ip_address).toLowerCase().includes(n)) return true
  if (c.service_name.toLowerCase().includes(n)) return true
  if (c.contact_methods?.name?.toLowerCase().includes(n)) return true
  const email = primaryEmail(c.contact_methods)
  if (email && email.toLowerCase().includes(n)) return true
  const phone = primaryPhone(c.contact_methods)
  if (phone && phone.toLowerCase().includes(n)) return true
  return false
}

export function ConnectionsView({ t, lang }: ConnectionsViewProps) {
  const [items, setItems] = useState<AllowedConnection[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [toRevoke, setToRevoke] = useState<AllowedConnection | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePersistedPageSize('rpacm-admin-connections-size', 10)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await listConnections()
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

  const filtered = useMemo(() => {
    if (!items) return []
    return items
      .filter((c) => matchesQuery(c, query))
      .sort((a, b) => a.service_name.localeCompare(b.service_name, undefined, { sensitivity: 'base' }))
  }, [items, query])

  const onQueryChange = (q: string) => {
    setQuery(q)
    setPage(1)
  }

  const pageItems = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  )

  const performRevoke = async () => {
    if (!toRevoke?._id) return
    await revokeConnection(toRevoke._id)
    setToRevoke(null)
    await refresh()
  }

  const onRevokeClick = async (
    e: MouseEvent<HTMLButtonElement>,
    c: AllowedConnection,
  ) => {
    if (e.shiftKey && c._id) {
      await revokeConnection(c._id)
      await refresh()
      return
    }
    setToRevoke(c)
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1 className="view-title">{t.connectionsTitle}</h1>
          <p className="view-lede">{t.connectionsLede}</p>
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
          icon={<ShieldIcon width={28} height={28} />}
          message={query ? t.noMatch : t.connectionsEmpty}
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
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t.colIp}</th>
                      <th>{t.colService}</th>
                      <th>{t.colContact}</th>
                      <th>{t.colExpiry}</th>
                      <th className="actions-col">{t.colActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((c) => (
                      <tr key={c._id ?? `${c.ip_address}-${c.service_name}`}>
                        <td className="mono cell-mono">{String(c.ip_address)}</td>
                        <td className="cell-title">{c.service_name}</td>
                        <td>
                          <ContactCell contact={c.contact_methods} t={t} />
                        </td>
                        <td>
                          <ExpiryCell expireAt={c.ExpireAt} lang={lang} t={t} />
                        </td>
                        <td className="actions-col">
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            onClick={(e) => void onRevokeClick(e, c)}
                            title={t.shiftSkipRevoke}
                          >
                            {t.revoke}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...paginationProps} variant="bottom" />
            </>
          )
        })()
      )}

      <ConfirmDialog
        open={!!toRevoke}
        title={t.revoke}
        labelConfirm={t.revoke}
        labelBusy={t.loading}
        labelCancel={t.cancel}
        labelClose={t.close}
        danger
        onConfirm={performRevoke}
        onClose={() => setToRevoke(null)}
      >
        {toRevoke ? (
          <p>
            {fmt(t.revokeConfirm, {
              ip: String(toRevoke.ip_address),
              service: toRevoke.service_name,
            })}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}

function ExpiryCell({
  expireAt,
  lang,
  t,
}: {
  expireAt: string | null
  lang: Lang
  t: Messages
}) {
  if (!expireAt) return <span className="muted">{t.expiresNever}</span>
  const d = new Date(expireAt)
  if (Number.isNaN(d.getTime())) return <span className="muted">—</span>
  const now = Date.now()
  const past = d.getTime() <= now
  return (
    <div className="expiry-cell">
      <span
        className={
          'expiry-primary' + (past ? ' expiry-primary--expired' : '')
        }
      >
        {past ? t.expired : fmt(t.expiresIn, { relative: formatRelativeTime(d, lang) })}
      </span>
      <span className="expiry-secondary">{formatDateTime(d, lang)}</span>
    </div>
  )
}
