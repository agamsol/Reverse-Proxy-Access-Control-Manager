import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import {
  HttpError,
  createAllowedConnection,
  listConnections,
  listServices,
  primaryEmail,
  primaryPhone,
  revokeConnection,
  updateAllowedConnection,
  type AllowedConnection,
  type CreateAllowedConnectionBody,
  type ServiceInfo,
  type UpdateAllowedConnectionBody,
} from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ContactCell } from '../components/ContactCell'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { usePersistedPageSize } from '../components/pagination-utils'
import { PlusIcon, PencilIcon, RefreshIcon, SearchIcon, ShieldIcon, CalendarIcon } from '../icons'
import type { Lang, Messages } from '../i18n'
import { fmt, formatDateTime, formatRelativeTime } from '../format'
import { parseDatetimeLocalToDate, toDatetimeLocalValue } from '../datetime-local'

type ConnectionsViewProps = {
  t: Messages
  lang: Lang
}

function catalogServiceName(s: ServiceInfo): string {
  const n = typeof s.name === 'string' ? s.name.trim() : ''
  if (n) return n
  return String(s.internal_address ?? '').trim()
}

type GrantDraft = {
  ip_address: string
  service_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  access_until_local: string
  expiry_minutes: string
}

function emptyGrantDraft(): GrantDraft {
  return {
    ip_address: '',
    service_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    access_until_local: '',
    expiry_minutes: '',
  }
}

function connectionToEditDraft(c: AllowedConnection): GrantDraft {
  const expireAt = c.ExpireAt ? new Date(c.ExpireAt) : null
  return {
    ip_address: String(c.ip_address),
    service_name: c.service_name,
    contact_name: c.contact_methods?.name ?? '',
    contact_email: primaryEmail(c.contact_methods) ?? '',
    contact_phone: primaryPhone(c.contact_methods) ?? '',
    access_until_local:
      expireAt && !Number.isNaN(expireAt.getTime()) ? toDatetimeLocalValue(expireAt) : '',
    expiry_minutes: '',
  }
}

function parseExpiryFields(
  accessUntilLocal: string,
  expiryMinutesRaw: string,
  t: Messages,
): { error: string } | { expire_at?: string; expiry_minutes?: number } {
  const untilRaw = accessUntilLocal.trim()
  const minsRaw = expiryMinutesRaw.trim()

  if (untilRaw) {
    const end = parseDatetimeLocalToDate(untilRaw)
    if (!end || end.getTime() <= Date.now()) {
      return { error: t.errConnectionExpirePast }
    }
    return { expire_at: end.toISOString() }
  }
  if (minsRaw) {
    const n = Number.parseInt(minsRaw, 10)
    if (!Number.isFinite(n) || n < 1 || n > 525600) {
      return { error: t.errConnectionExpiryInvalid }
    }
    return { expiry_minutes: n }
  }
  return {}
}

function matchesQuery(c: AllowedConnection, q: string): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  if (String(c.ip_address).toLowerCase().includes(n)) return true
  if ((c.service_name ?? '').toLowerCase().includes(n)) return true
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
  const [editing, setEditing] = useState<AllowedConnection | null>(null)

  const [grantOpen, setGrantOpen] = useState(false)
  const [grantDraft, setGrantDraft] = useState<GrantDraft>(emptyGrantDraft)
  const [grantError, setGrantError] = useState<string | null>(null)
  const [grantSubmitting, setGrantSubmitting] = useState(false)
  const [editDraft, setEditDraft] = useState<GrantDraft>(emptyGrantDraft)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [serviceCatalog, setServiceCatalog] = useState<ServiceInfo[] | null>(null)

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

  const loadServiceCatalog = useCallback(async () => {
    setServiceCatalog(null)
    try {
      const list = await listServices()
      setServiceCatalog(list.filter((s) => catalogServiceName(s)))
    } catch {
      setServiceCatalog([])
    }
  }, [])

  const openGrantModal = () => {
    setGrantDraft(emptyGrantDraft())
    setGrantError(null)
    setGrantOpen(true)
    void loadServiceCatalog()
  }

  const closeGrantModal = () => {
    if (grantSubmitting) return
    setGrantOpen(false)
  }

  const openEditModal = (c: AllowedConnection) => {
    setEditing(c)
    setEditDraft(connectionToEditDraft(c))
    setEditError(null)
  }

  const closeEditModal = () => {
    if (editSubmitting) return
    setEditing(null)
  }

  const submitGrant = async (e: FormEvent) => {
    e.preventDefault()
    setGrantError(null)
    const ip = grantDraft.ip_address.trim()
    if (!ip) {
      setGrantError(t.errConnectionIpRequired)
      return
    }
    if (!grantDraft.service_name.trim()) {
      setGrantError(t.errConnectionServiceRequired)
      return
    }
    const expiry = parseExpiryFields(
      grantDraft.access_until_local,
      grantDraft.expiry_minutes,
      t,
    )
    if ('error' in expiry) {
      setGrantError(expiry.error)
      return
    }

    const body: CreateAllowedConnectionBody = {
      ip_address: ip,
      service_name: grantDraft.service_name.trim(),
    }
    const cn = grantDraft.contact_name.trim()
    if (cn) body.contact_name = cn
    const ce = grantDraft.contact_email.trim()
    if (ce) body.contact_email = ce
    const cp = grantDraft.contact_phone.trim()
    if (cp) body.contact_phone = cp
    if (expiry.expire_at != null) body.expire_at = expiry.expire_at
    if (expiry.expiry_minutes != null) body.expiry_minutes = expiry.expiry_minutes

    setGrantSubmitting(true)
    try {
      await createAllowedConnection(body)
      setGrantOpen(false)
      await refresh()
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 409) setGrantError(t.errConnectionDuplicate)
        else if (err.status === 404) setGrantError(t.errConnectionService404)
        else setGrantError(err.detail || err.message)
      } else {
        setGrantError(t.errGeneric)
      }
    } finally {
      setGrantSubmitting(false)
    }
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing?._id) return
    setEditError(null)

    const expiry = parseExpiryFields(editDraft.access_until_local, editDraft.expiry_minutes, t)
    if ('error' in expiry) {
      setEditError(expiry.error)
      return
    }

    const body: UpdateAllowedConnectionBody = {
      contact_name: editDraft.contact_name.trim() || null,
      contact_email: editDraft.contact_email.trim() || null,
      contact_phone: editDraft.contact_phone.trim() || null,
    }
    if (expiry.expire_at != null) body.expire_at = expiry.expire_at
    if (expiry.expiry_minutes != null) body.expiry_minutes = expiry.expiry_minutes

    setEditSubmitting(true)
    try {
      await updateAllowedConnection(editing._id, body)
      setEditing(null)
      await refresh()
    } catch (err) {
      if (err instanceof HttpError) {
        setEditError(err.detail || err.message)
      } else {
        setEditError(t.errGeneric)
      }
    } finally {
      setEditSubmitting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!items) return []
    return items
      .filter((c) => matchesQuery(c, query))
      .sort((a, b) =>
        (a.service_name ?? '').localeCompare(b.service_name ?? '', undefined, {
          sensitivity: 'base',
        }),
      )
  }, [items, query])

  const grantAccessSummary = useMemo(() => {
    const s = grantDraft.access_until_local.trim()
    if (!s) return null
    const end = parseDatetimeLocalToDate(s)
    if (!end || end.getTime() <= Date.now()) return null
    return fmt(t.accessUntilAfterApproval, { relative: formatRelativeTime(end, lang) })
  }, [grantDraft.access_until_local, t, lang])

  const editAccessSummary = useMemo(() => {
    const s = editDraft.access_until_local.trim()
    if (!s) return null
    const end = parseDatetimeLocalToDate(s)
    if (!end || end.getTime() <= Date.now()) return null
    return fmt(t.accessUntilAfterApproval, { relative: formatRelativeTime(end, lang) })
  }, [editDraft.access_until_local, t, lang])

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

  const showTable = items !== null && filtered.length > 0
  const showEmpty = items !== null && filtered.length === 0

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
          <button type="button" className="btn btn--primary btn--sm" onClick={openGrantModal}>
            <PlusIcon width={14} height={14} />
            <span>{t.connectionsAddBtn}</span>
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
      ) : showEmpty ? (
        <EmptyState
          icon={<ShieldIcon width={28} height={28} />}
          message={query ? t.noMatch : t.connectionsEmpty}
        />
      ) : showTable ? (
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
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => openEditModal(c)}
                              aria-label={t.edit}
                              title={t.edit}
                            >
                              <PencilIcon width={14} height={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger btn--sm"
                              onClick={(e) => void onRevokeClick(e, c)}
                              title={t.shiftSkipRevoke}
                            >
                              {t.revoke}
                            </button>
                          </div>
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
      ) : null}

      <Modal
        open={grantOpen}
        onClose={closeGrantModal}
        title={t.connectionsAddTitle}
        labelClose={t.close}
        size="md"
        busy={grantSubmitting}
        footer={
          <>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={closeGrantModal}
              disabled={grantSubmitting}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              form="grant-connection-form"
              className="btn btn--primary"
              disabled={
                grantSubmitting ||
                serviceCatalog === null ||
                serviceCatalog.length === 0
              }
            >
              {grantSubmitting ? t.creating : t.create}
            </button>
          </>
        }
      >
        <form id="grant-connection-form" className="stack" onSubmit={(e) => void submitGrant(e)}>
          <div className="field">
            <label htmlFor="grant-ip" className="label-row">
              {t.connectionsAddIpLabel}
              <span className="required-mark">*</span>
            </label>
            <input
              id="grant-ip"
              className="input mono"
              value={grantDraft.ip_address}
              onChange={(e) => setGrantDraft({ ...grantDraft, ip_address: e.target.value })}
              disabled={grantSubmitting}
              required
              autoComplete="off"
            />
            <p className="field-hint">{t.connectionsAddIpHint}</p>
          </div>
          <div className="field">
            <label htmlFor="grant-svc" className="label-row">
              {t.connectionsAddServiceLabel}
              <span className="required-mark">*</span>
            </label>
            <select
              id="grant-svc"
              className="input"
              value={grantDraft.service_name}
              onChange={(e) =>
                setGrantDraft({ ...grantDraft, service_name: e.target.value })
              }
              disabled={grantSubmitting || serviceCatalog === null || serviceCatalog.length === 0}
              required
            >
              <option value="">{t.connectionsAddServicePlaceholder}</option>
              {(serviceCatalog ?? []).map((s, idx) => {
                const v = catalogServiceName(s)
                return (
                  <option key={`${v}-${idx}`} value={v}>
                    {v}
                  </option>
                )
              })}
            </select>
            {serviceCatalog && serviceCatalog.length === 0 ? (
              <p className="field-hint">{t.connectionsNoServicesHint}</p>
            ) : null}
          </div>
          <p className="field-hint" style={{ marginTop: '-0.25rem' }}>
            {t.connectionsAddContactHint}
          </p>
          <div className="field">
            <label htmlFor="grant-cname" className="label-row">
              {t.connectionsAddContactNameLabel}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="grant-cname"
              className="input"
              maxLength={32}
              value={grantDraft.contact_name}
              onChange={(e) => setGrantDraft({ ...grantDraft, contact_name: e.target.value })}
              disabled={grantSubmitting}
            />
          </div>
          <div className="field">
            <label htmlFor="grant-cemail" className="label-row">
              {t.connectionsAddContactEmailLabel}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="grant-cemail"
              className="input"
              type="email"
              inputMode="email"
              value={grantDraft.contact_email}
              onChange={(e) => setGrantDraft({ ...grantDraft, contact_email: e.target.value })}
              disabled={grantSubmitting}
            />
          </div>
          <div className="field">
            <label htmlFor="grant-cphone" className="label-row">
              {t.connectionsAddContactPhoneLabel}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="grant-cphone"
              className="input"
              value={grantDraft.contact_phone}
              onChange={(e) => setGrantDraft({ ...grantDraft, contact_phone: e.target.value })}
              disabled={grantSubmitting}
            />
          </div>
          <h3 className="form-section-title">{t.connectionsAddSectionDetails}</h3>
          <div className="field">
            <label htmlFor="grant-access-until" className="label-row">
              <CalendarIcon width={14} height={14} className="label-icon" />
              {t.connectionsAddExpiryLabel}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="grant-access-until"
              className="input input-datetime-local"
              type="datetime-local"
              min={toDatetimeLocalValue(new Date())}
              step={60}
              value={grantDraft.access_until_local}
              onChange={(e) =>
                setGrantDraft({ ...grantDraft, access_until_local: e.target.value })
              }
              disabled={grantSubmitting}
            />
            {grantAccessSummary ? (
              <div className="access-until-embed" role="status">
                <p className="access-until-embed__text">{grantAccessSummary}</p>
              </div>
            ) : null}
            <p className="field-hint">{t.connectionsAddExpiryHint}</p>
          </div>
          <div className="field">
            <label htmlFor="grant-exp" className="label-row">
              {t.connectionsAddExpiryMinutesAlt}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="grant-exp"
              className="input mono"
              type="number"
              inputMode="numeric"
              min={1}
              max={525600}
              placeholder=""
              value={grantDraft.expiry_minutes}
              onChange={(e) =>
                setGrantDraft({ ...grantDraft, expiry_minutes: e.target.value })
              }
              disabled={grantSubmitting}
            />
            <p className="field-hint">{t.connectionsAddExpiryMinutesAltHint}</p>
          </div>
          {grantError ? (
            <div className="feedback error" role="alert">
              {grantError}
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={!!editing}
        onClose={closeEditModal}
        title={t.connectionsEditTitle}
        labelClose={t.close}
        size="md"
        busy={editSubmitting}
        footer={
          <>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={closeEditModal}
              disabled={editSubmitting}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              form="edit-connection-form"
              className="btn btn--primary"
              disabled={editSubmitting}
            >
              {editSubmitting ? t.saving : t.save}
            </button>
          </>
        }
      >
        <form id="edit-connection-form" className="stack" onSubmit={(e) => void submitEdit(e)}>
          <div className="field">
            <label htmlFor="edit-ip" className="label-row">
              {t.connectionsAddIpLabel}
            </label>
            <input
              id="edit-ip"
              className="input mono"
              value={editDraft.ip_address}
              disabled
              readOnly
              aria-readonly
            />
          </div>
          <div className="field">
            <label htmlFor="edit-svc" className="label-row">
              {t.connectionsAddServiceLabel}
            </label>
            <input
              id="edit-svc"
              className="input"
              value={editDraft.service_name}
              disabled
              readOnly
              aria-readonly
            />
          </div>
          <p className="field-hint" style={{ marginTop: '-0.25rem' }}>
            {t.connectionsEditContactHint}
          </p>
          <div className="field">
            <label htmlFor="edit-cname" className="label-row">
              {t.connectionsAddContactNameLabel}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="edit-cname"
              className="input"
              maxLength={32}
              value={editDraft.contact_name}
              onChange={(e) => setEditDraft({ ...editDraft, contact_name: e.target.value })}
              disabled={editSubmitting}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-cemail" className="label-row">
              {t.connectionsAddContactEmailLabel}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="edit-cemail"
              className="input"
              type="email"
              inputMode="email"
              value={editDraft.contact_email}
              onChange={(e) => setEditDraft({ ...editDraft, contact_email: e.target.value })}
              disabled={editSubmitting}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-cphone" className="label-row">
              {t.connectionsAddContactPhoneLabel}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="edit-cphone"
              className="input"
              value={editDraft.contact_phone}
              onChange={(e) => setEditDraft({ ...editDraft, contact_phone: e.target.value })}
              disabled={editSubmitting}
            />
          </div>
          <h3 className="form-section-title">{t.connectionsAddSectionDetails}</h3>
          <div className="field">
            <label htmlFor="edit-access-until" className="label-row">
              <CalendarIcon width={14} height={14} className="label-icon" />
              {t.connectionsAddExpiryLabel}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="edit-access-until"
              className="input input-datetime-local"
              type="datetime-local"
              min={toDatetimeLocalValue(new Date())}
              step={60}
              value={editDraft.access_until_local}
              onChange={(e) =>
                setEditDraft({ ...editDraft, access_until_local: e.target.value })
              }
              disabled={editSubmitting}
            />
            {editAccessSummary ? (
              <div className="access-until-embed" role="status">
                <p className="access-until-embed__text">{editAccessSummary}</p>
              </div>
            ) : null}
            <p className="field-hint">{t.connectionsAddExpiryHint}</p>
          </div>
          <div className="field">
            <label htmlFor="edit-exp" className="label-row">
              {t.connectionsAddExpiryMinutesAlt}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="edit-exp"
              className="input mono"
              type="number"
              inputMode="numeric"
              min={1}
              max={525600}
              placeholder=""
              value={editDraft.expiry_minutes}
              onChange={(e) =>
                setEditDraft({ ...editDraft, expiry_minutes: e.target.value })
              }
              disabled={editSubmitting}
            />
            <p className="field-hint">{t.connectionsAddExpiryMinutesAltHint}</p>
          </div>
          {editError ? (
            <div className="feedback error" role="alert">
              {editError}
            </div>
          ) : null}
        </form>
      </Modal>

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
