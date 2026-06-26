import { LogoutIcon } from '../icons'
import { Avatar } from '../components/Avatar'
import type { Messages } from '../i18n'

type AccountSettingsProps = {
  t: Messages
  username: string | null
  onLogout: () => void
}

const PRIVATE_ENV_EXAMPLE = `# data/private.env
ADMIN_USERNAME=your_admin_name
ADMIN_PASSWORD=your_new_password

JWT_SECRET_KEY=your_secret_key
JWT_ALGORITHM=HS256`

export function AccountSettings({ t, username, onLogout }: AccountSettingsProps) {
  const passwordSteps = [
    t.accountPasswordStep1,
    t.accountPasswordStep2,
    t.accountPasswordStep3,
    t.accountPasswordStep4,
    t.accountPasswordStep5,
  ]

  return (
    <div className="settings-panel">
      <div className="settings-panel-head">
        <div>
          <h2 className="settings-panel-title">{t.accountTitle}</h2>
          <p className="settings-panel-lede">{t.accountLede}</p>
        </div>
      </div>

      <section className="appearance-section account-card">
        {username ? (
          <div className="account-profile">
            <Avatar name={username} size={48} />
            <div className="account-profile-meta">
              <span className="account-profile-label">{t.accountSignedInLabel}</span>
              <span className="account-profile-name">{username}</span>
            </div>
          </div>
        ) : null}

        <p className="appearance-section-lede">{t.accountSignOutLede}</p>

        <button type="button" className="btn btn--danger-soft appearance-signout" onClick={onLogout}>
          <LogoutIcon width={16} height={16} aria-hidden />
          <span>{t.logout}</span>
        </button>
      </section>

      <section className="appearance-section account-help">
        <h3 className="appearance-section-title">{t.accountPasswordHeading}</h3>
        <p className="appearance-section-lede">{t.accountPasswordLede}</p>

        <ol className="account-help-steps" aria-label={t.accountPasswordStepsAria}>
          {passwordSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="account-help-example">
          <span className="account-help-example-label">{t.accountPasswordExampleLabel}</span>
          <pre className="account-help-code mono">{PRIVATE_ENV_EXAMPLE}</pre>
        </div>

        <p className="account-help-note">{t.accountPasswordSecurityNote}</p>
      </section>
    </div>
  )
}
