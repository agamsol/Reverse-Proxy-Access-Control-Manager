import { useState, type FormEvent } from 'react'
import { HttpError, login } from '../api'
import { setToken } from '../auth'
import { primePendingNotificationSound } from '../pending-sound'
import { EyeIcon, EyeOffIcon, UserIcon } from '../icons'
import type { Messages } from '../i18n'

type LoginProps = {
  t: Messages
  onSuccess: (token: string) => void
}

export function LoginView({ t, onSuccess }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    primePendingNotificationSound()
    setError(null)
    setSubmitting(true)
    try {
      const res = await login(username.trim(), password, rememberMe)
      setToken(res.access_token)
      onSuccess(res.access_token)
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401) setError(t.errLoginFailed)
        else setError(err.detail || t.errLoginGeneric)
      } else {
        setError(t.errLoginGeneric)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <img
            className="auth-brand-mark"
            src={`${import.meta.env.BASE_URL}app-icon.png`}
            alt=""
            aria-hidden
          />
          <div className="auth-brand-text">
            <span className="auth-brand-title">{t.brand}</span>
          </div>
        </div>

        <h1 className="auth-title">{t.loginTitle}</h1>
        <p className="auth-lede">{t.loginLede}</p>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-username" className="label-row">
              <UserIcon width={14} height={14} />
              {t.usernameLabel}
            </label>
            <input
              id="login-username"
              className="input"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              minLength={3}
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="field">
            <label htmlFor="login-password" className="label-row">
              {t.passwordLabel}
            </label>
            <div className="input-combo">
              <input
                id="login-password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={199}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
              <button
                type="button"
                className="input-combo-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOffIcon width={16} height={16} />
                ) : (
                  <EyeIcon width={16} height={16} />
                )}
              </button>
            </div>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={submitting}
            />
            <span className="checkbox-row-text">
              <span>{t.rememberMeLabel}</span>
              <span className="field-hint">{t.rememberMeHint}</span>
            </span>
          </label>

          {error ? (
            <div className="feedback error" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn btn--primary btn--lg auth-submit"
            disabled={submitting || !username.trim() || !password}
          >
            {submitting ? t.signingIn : t.signIn}
          </button>
        </form>
      </div>
    </div>
  )
}
