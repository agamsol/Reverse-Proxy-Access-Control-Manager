import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  HttpError,
  listIgnored,
  primaryEmail,
  primaryPhone,
  removeIgnored,
  type DeniedConnection,
} from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ContactCell } from '../components/ContactCell'
import { EmptyState } from '../components/EmptyState'
import { Pagination } from '../components/Pagination'
import { usePersistedPageSize } from '../components/pagination-utils'
import { BanIcon, RefreshIcon, SearchIcon } from '../icons'
import type { Messages } from '../i18n'
import { fmt } from '../format'

type IgnoredViewProps = {
  t: Messages
}

function matchesQuery(c: DeniedConnection, q: string): boolean {
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

export function IgnoredView({ t }: IgnoredViewProps) {
  const [items, setItems] = useState<DeniedConnection[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [toRemove, setToRemove] = useState<DeniedConnection | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePersistedPageSize('rpacm-admin-ignored-size', 10)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await listIgnored()
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

  const performRemove = async () => {
    if (!toRemove?._id) return
    await removeIgnored(toRemove._id)
    setToRemove(null)
    await refresh()
  }

  const onUnignoreClick = async (
    e: MouseEvent<HTMLButtonElement>,
    c: DeniedConnection,
  ) => {
    if (e.shiftKey && c._id) {
      await removeIgnored(c._id)
      await refresh()
      return
    }
    setToRemove(c)
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1 className="view-title">{t.ignoredTitle}</h1>
          <p className="view-lede">{t.ignoredLede}</p>
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
          icon={<BanIcon width={28} height={28} />}
          message={query ? t.noMatch : t.ignoredEmpty}
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
                        <td className="actions-col">
                          <button
                            type="button"
                            className="btn btn--danger-soft btn--sm"
                            onClick={(e) => void onUnignoreClick(e, c)}
                            title={t.shiftSkipUnignore}
                          >
                            {t.unignore}
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
        open={!!toRemove}
        title={t.unignore}
        labelConfirm={t.unignore}
        labelBusy={t.loading}
        labelCancel={t.cancel}
        labelClose={t.close}
        onConfirm={performRemove}
        onClose={() => setToRemove(null)}
      >
        {toRemove ? (
          <p>
            {fmt(t.unignoreConfirm, {
              ip: String(toRemove.ip_address),
              service: toRemove.service_name,
            })}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
