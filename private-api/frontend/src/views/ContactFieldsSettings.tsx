import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  HttpError,
  getContactFieldsConfig,
  updateContactFieldsConfig,
  type ContactFieldName,
  type ContactFieldsConfig,
} from '../api'
import type { Messages } from '../i18n'

type ContactFieldsSettingsProps = {
  t: Messages
}

type FieldDraft = ContactFieldsConfig[ContactFieldName]

const FIELD_ORDER: ContactFieldName[] = ['name', 'email', 'phone_number']

function fieldLabel(field: ContactFieldName, t: Messages): string {
  switch (field) {
    case 'name':
      return t.contactFieldsName
    case 'email':
      return t.contactFieldsEmail
    case 'phone_number':
      return t.contactFieldsPhone
  }
}

export function ContactFieldsSettings({ t }: ContactFieldsSettingsProps) {
  const [draft, setDraft] = useState<ContactFieldsConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const cfg = await getContactFieldsConfig()
      setDraft(cfg)
    } catch (e) {
      setLoadError(e instanceof HttpError ? e.detail || e.message : t.errLoadFailed)
    } finally {
      setLoading(false)
    }
  }, [t.errLoadFailed])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setField = (field: ContactFieldName, patch: Partial<FieldDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev[field], ...patch }
      if (patch.visible === false) {
        next.required = false
      }
      return { ...prev, [field]: next }
    })
    setSavedNotice(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    setFormError(null)
    setSavedNotice(null)
    setSaving(true)
    try {
      const saved = await updateContactFieldsConfig(draft)
      setDraft(saved)
      setSavedNotice(t.contactFieldsSaved)
    } catch (err) {
      setFormError(
        err instanceof HttpError
          ? err.detail || err.message
          : t.contactFieldsSaveFailed,
      )
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="settings-panel">
        <p className="form-error" role="alert">
          {loadError}
        </p>
        <button type="button" className="btn btn--quiet btn--sm" onClick={refresh}>
          {t.retry}
        </button>
      </div>
    )
  }

  if (!draft || loading) {
    return (
      <div className="settings-panel">
        <p className="muted-text">{t.loading}</p>
      </div>
    )
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-head">
        <div>
          <h2 className="settings-panel-title">{t.contactFieldsTitle}</h2>
          <p className="settings-panel-lede">{t.contactFieldsLede}</p>
        </div>
      </div>

      <form className="contact-fields-form" onSubmit={submit}>
        <div className="contact-fields-grid">
          {FIELD_ORDER.map((field) => (
            <section className="contact-fields-card" key={field}>
              <h3 className="contact-fields-card-title">{fieldLabel(field, t)}</h3>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={draft[field].visible}
                  onChange={(e) => setField(field, { visible: e.target.checked })}
                />
                <span className="checkbox-row-text">
                  <span>{t.contactFieldsVisible}</span>
                  <span className="field-hint muted-text">{t.contactFieldsVisibleHint}</span>
                </span>
              </label>
              <label className={'checkbox-row' + (draft[field].visible ? '' : ' is-disabled')}>
                <input
                  type="checkbox"
                  checked={draft[field].required}
                  disabled={!draft[field].visible}
                  onChange={(e) => setField(field, { required: e.target.checked })}
                />
                <span className="checkbox-row-text">
                  <span>{t.contactFieldsRequired}</span>
                  <span className="field-hint muted-text">{t.contactFieldsRequiredHint}</span>
                </span>
              </label>
            </section>
          ))}
        </div>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        {savedNotice ? (
          <p className="form-success" role="status">
            {savedNotice}
          </p>
        ) : null}

        <div className="contact-fields-actions">
          <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
            {saving ? t.saving : t.save}
          </button>
        </div>
      </form>
    </div>
  )
}
