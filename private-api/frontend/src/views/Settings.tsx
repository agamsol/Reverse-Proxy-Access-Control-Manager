import { useState } from 'react'
import type { Messages } from '../i18n'
import { AccountSettings } from './AccountSettings'
import { AppearanceSettings } from './AppearanceSettings'
import { ContactFieldsSettings } from './ContactFieldsSettings'
import { ServicesView } from './Services'
import { WebhooksView } from './Webhooks'

type SettingsViewProps = {
  t: Messages
  username: string | null
  onLogout: () => void
}

export type SettingsSubTab =
  | 'appearance'
  | 'account'
  | 'contact-fields'
  | 'services'
  | 'webhooks'

export function SettingsView({ t, username, onLogout }: SettingsViewProps) {
  const [subTab, setSubTab] = useState<SettingsSubTab>('appearance')

  const subTabs: { id: SettingsSubTab; label: string }[] = [
    { id: 'appearance', label: t.settingsAppearance },
    { id: 'account', label: t.settingsAccount },
    { id: 'contact-fields', label: t.settingsContactFields },
    { id: 'services', label: t.settingsServices },
    { id: 'webhooks', label: t.settingsWebhooks },
  ]

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1 className="view-title">{t.settingsTitle}</h1>
          <p className="view-lede">{t.settingsLede}</p>
        </div>
      </div>

      <nav className="settings-subnav" aria-label={t.settingsSectionsAria}>
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={'settings-subnav-btn' + (subTab === tab.id ? ' is-active' : '')}
            onClick={() => setSubTab(tab.id)}
            aria-current={subTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {subTab === 'appearance' ? <AppearanceSettings t={t} /> : null}
      {subTab === 'account' ? (
        <AccountSettings t={t} username={username} onLogout={onLogout} />
      ) : null}
      {subTab === 'contact-fields' ? <ContactFieldsSettings t={t} /> : null}
      {subTab === 'services' ? <ServicesView t={t} embedded /> : null}
      {subTab === 'webhooks' ? <WebhooksView t={t} embedded /> : null}
    </div>
  )
}
