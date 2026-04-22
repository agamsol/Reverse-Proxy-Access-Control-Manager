import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  HttpError,
  createService,
  deleteService,
  editService,
  listServices,
  type Protocol,
  type ServiceEditPayload,
  type ServiceInfo,
} from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import {
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  ServerIcon,
  TrashIcon,
} from '../icons'
import type { Messages } from '../i18n'
import { fmt } from '../format'

type ServicesViewProps = {
  t: Messages
}

type ServiceDraft = {
  name: string
  description: string
  internal_address: string
  port: string
  protocol: Protocol
}

function toDraft(s?: ServiceInfo): ServiceDraft {
  return {
    name: s?.name ?? '',
    description: s?.description ?? '',
    internal_address: s?.internal_address ?? '127.0.0.1',
    port: s ? String(s.port) : '80',
    protocol: s?.protocol ?? 'http',
  }
}

function draftValid(d: ServiceDraft): boolean {
  if (!d.name.trim()) return false
  const port = Number(d.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false
  return true
}

function matchesQuery(s: ServiceInfo, q: string): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  return (
    s.name.toLowerCase().includes(n) ||
    (s.description?.toLowerCase().includes(n) ?? false) ||
    String(s.internal_address).toLowerCase().includes(n)
  )
}

export function ServicesView({ t }: ServicesViewProps) {
  const [items, setItems] = useState<ServiceInfo[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceInfo | null>(null)
  const [draft, setDraft] = useState<ServiceDraft>(toDraft())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [toDelete, setToDelete] = useState<ServiceInfo | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await listServices()
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
      .filter((s) => matchesQuery(s, query))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [items, query])

  const openCreate = () => {
    setEditing(null)
    setDraft(toDraft())
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (s: ServiceInfo) => {
    setEditing(s)
    setDraft(toDraft(s))
    setFormError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    if (submitting) return
    setFormOpen(false)
  }

  const submitForm = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!draft.name.trim()) {
      setFormError(t.errServiceNameRequired)
      return
    }
    const port = Number(draft.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setFormError(t.errServicePort)
      return
    }
    setSubmitting(true)
    try {
      if (editing) {
        const payload: ServiceEditPayload = {
          name: draft.name !== editing.name ? draft.name.trim() : null,
          description: (draft.description.trim() || null) !== (editing.description ?? null)
            ? (draft.description.trim() || null)
            : null,
          internal_address:
            draft.internal_address.trim() !== editing.internal_address
              ? draft.internal_address.trim()
              : null,
          port: port !== editing.port ? port : null,
          protocol: draft.protocol !== editing.protocol ? draft.protocol : null,
        }
        await editService(editing.name, payload)
      } else {
        await createService({
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          internal_address: draft.internal_address.trim(),
          port,
          protocol: draft.protocol,
        })
      }
      setFormOpen(false)
      await refresh()
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.status === 409) setFormError(t.errServiceExists)
        else if (e.status === 404) setFormError(t.errServiceNotFound)
        else setFormError(e.detail || e.message)
      } else {
        setFormError(t.errGeneric)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const performDelete = async () => {
    if (!toDelete) return
    await deleteService(toDelete.name)
    setToDelete(null)
    await refresh()
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1 className="view-title">{t.servicesTitle}</h1>
          <p className="view-lede">{t.servicesLede}</p>
        </div>
        <div className="view-head-actions">
          <button type="button" className="btn btn--quiet btn--sm" onClick={refresh}>
            <RefreshIcon width={14} height={14} />
            <span>{t.refresh}</span>
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={openCreate}>
            <PlusIcon width={14} height={14} />
            <span>{t.servicesNewBtn}</span>
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
            onChange={(e) => setQuery(e.target.value)}
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
          icon={<ServerIcon width={28} height={28} />}
          message={query ? t.noMatch : t.servicesEmpty}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.colName}</th>
                <th>{t.colDescription}</th>
                <th>{t.colDestination}</th>
                <th className="num">{t.colPort}</th>
                <th>{t.colProtocol}</th>
                <th className="actions-col">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.name}>
                  <td className="cell-title">{s.name}</td>
                  <td className="cell-muted">
                    {s.description ? s.description : <span className="muted">—</span>}
                  </td>
                  <td className="mono cell-mono">{String(s.internal_address)}</td>
                  <td className="mono num">{s.port}</td>
                  <td>
                    <span
                      className={
                        'proto-badge ' +
                        (s.protocol === 'https' ? 'proto-badge--secure' : 'proto-badge--open')
                      }
                    >
                      {s.protocol}
                    </span>
                  </td>
                  <td className="actions-col">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => openEdit(s)}
                        aria-label={t.edit}
                        title={t.edit}
                      >
                        <PencilIcon width={14} height={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => setToDelete(s)}
                        aria-label={t.delete}
                        title={t.delete}
                      >
                        <TrashIcon width={14} height={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? t.servicesEditTitle : t.servicesCreateTitle}
        labelClose={t.close}
        size="md"
        busy={submitting}
        footer={
          <>
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
              form="service-form"
              className="btn btn--primary"
              disabled={submitting || !draftValid(draft)}
            >
              {submitting ? (editing ? t.saving : t.creating) : editing ? t.save : t.create}
            </button>
          </>
        }
      >
        <form id="service-form" className="stack" onSubmit={submitForm}>
          <div className="field">
            <label htmlFor="svc-name" className="label-row">
              {t.servicesNameLabel}
              <span className="required-mark">*</span>
            </label>
            <input
              id="svc-name"
              className="input"
              maxLength={200}
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              disabled={submitting}
            />
            <p className="field-hint">{t.servicesNameHint}</p>
          </div>
          <div className="field">
            <label htmlFor="svc-desc" className="label-row">
              {t.servicesDescriptionLabel}
              <span className="optional-mark">{t.optional}</span>
            </label>
            <input
              id="svc-desc"
              className="input"
              maxLength={200}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              disabled={submitting}
            />
            <p className="field-hint">{t.servicesDescriptionHint}</p>
          </div>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="svc-addr" className="label-row">
                {t.servicesAddressLabel}
              </label>
              <input
                id="svc-addr"
                className="input mono"
                value={draft.internal_address}
                onChange={(e) => setDraft({ ...draft, internal_address: e.target.value })}
                disabled={submitting}
                required
              />
              <p className="field-hint">{t.servicesAddressHint}</p>
            </div>
            <div className="field">
              <label htmlFor="svc-port" className="label-row">
                {t.servicesPortLabel}
              </label>
              <input
                id="svc-port"
                className="input mono"
                type="number"
                inputMode="numeric"
                min={1}
                max={65535}
                value={draft.port}
                onChange={(e) => setDraft({ ...draft, port: e.target.value })}
                disabled={submitting}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="svc-proto" className="label-row">
              {t.servicesProtocolLabel}
            </label>
            <div className="segmented" role="group" aria-labelledby="svc-proto">
              {(['http', 'https'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={'segmented-btn ' + (draft.protocol === p ? 'is-active' : '')}
                  onClick={() => setDraft({ ...draft, protocol: p })}
                  disabled={submitting}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {formError ? (
            <div className="feedback error" role="alert">
              {formError}
            </div>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title={t.servicesDeleteTitle}
        labelConfirm={t.delete}
        labelBusy={t.deleting}
        labelCancel={t.cancel}
        labelClose={t.close}
        danger
        onConfirm={performDelete}
        onClose={() => setToDelete(null)}
      >
        {toDelete ? <p>{fmt(t.servicesDeletePrompt, { name: toDelete.name })}</p> : null}
      </ConfirmDialog>
    </div>
  )
}
