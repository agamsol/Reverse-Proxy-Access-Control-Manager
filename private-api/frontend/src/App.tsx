import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  HttpError,
  getStatus,
  listPending,
  setUnauthorizedHandler,
  type StatusInfo,
} from './api'
import {
  clearToken,
  decodeJwt,
  getToken,
  isTokenValid,
  type TokenPayload,
} from './auth'
import {
  BanIcon,
  ClockIcon,
  GitHubIcon,
  LogoutIcon,
  MenuIcon,
  ServerIcon,
  ShieldIcon,
  WebhookIcon,
} from './icons'
import { strings } from './i18n'
import { useEnglishOnlyLocale, useTheme } from './hooks'
import { Avatar } from './components/Avatar'
import { LoginView } from './views/Login'
import { ServicesView } from './views/Services'
import { PendingView } from './views/Pending'
import { ConnectionsView } from './views/Connections'
import { IgnoredView } from './views/Ignored'
import { WebhooksView } from './views/Webhooks'
import './App.css'

const GITHUB_URL = 'https://github.com/agamsol/Reverse-Proxy-Access-Control-Manager'
const PENDING_POLL_MS = 30_000

type Tab = 'services' | 'pending' | 'connections' | 'ignored' | 'webhooks'

type TabGroup = {
  id: 'access' | 'config'
  labelKey: 'navGroupConnections' | 'navGroupConfiguration'
  tabs: readonly Tab[]
}

// Grouped so the sidebar shows access-management items first, then a visible
// separator into a "configuration" cluster (services + webhooks).
const TAB_GROUPS: readonly TabGroup[] = [
  {
    id: 'access',
    labelKey: 'navGroupConnections',
    tabs: ['pending', 'connections', 'ignored'],
  },
  {
    id: 'config',
    labelKey: 'navGroupConfiguration',
    tabs: ['services', 'webhooks'],
  },
]

const NARROW_SIDEBAR_MQ = '(max-width: 820px)'

function useNarrowSidebar(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_SIDEBAR_MQ).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(NARROW_SIDEBAR_MQ)
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

function tabIcon(tab: Tab) {
  // Webhook glyph has more negative space than the others; render it a
  // hair larger so it reads at the same visual weight as Server/Clock/Shield.
  switch (tab) {
    case 'services':
      return <ServerIcon width={17} height={17} />
    case 'pending':
      return <ClockIcon width={17} height={17} />
    case 'connections':
      return <ShieldIcon width={17} height={17} />
    case 'ignored':
      return <BanIcon width={17} height={17} />
    case 'webhooks':
      return <WebhookIcon width={19} height={19} />
  }
}

export default function App() {
  const { theme, toggle } = useTheme()
  useEnglishOnlyLocale()
  const t = strings.en

  const [token, setTokenState] = useState<string | null>(() => {
    const existing = getToken()
    return isTokenValid(existing) ? existing : null
  })
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)

  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const isNarrow = useNarrowSidebar()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isNarrow) setSidebarOpen(false)
  }, [isNarrow])

  useEffect(() => {
    if (!isNarrow || !sidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isNarrow, sidebarOpen])

  useEffect(() => {
    if (!isNarrow || !sidebarOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isNarrow, sidebarOpen])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setTokenState(null)
      setSessionNotice(t.sessionExpired)
    })
    return () => setUnauthorizedHandler(null)
  }, [t.sessionExpired])

  useEffect(() => {
    document.title = t.appTitle
  }, [t.appTitle])

  useEffect(() => {
    let cancelled = false
    const fetchStatus = async () => {
      try {
        const s = await getStatus()
        if (!cancelled) {
          setStatus(s)
          setStatusError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setStatusError(e instanceof HttpError ? e.detail || e.message : t.errLoadFailed)
        }
      }
    }
    void fetchStatus()
    return () => {
      cancelled = true
    }
  }, [t.errLoadFailed])

  // Poll pending requests so the sidebar badge stays current even when the
  // Pending tab isn't active.
  const refreshPendingCount = useCallback(async () => {
    if (!token) return
    try {
      const list = await listPending()
      setPendingCount(list.length)
    } catch {
      // Silently ignore — the Pending view surfaces errors when it's opened.
    }
  }, [token])

  const pollRef = useRef<number | null>(null)
  useEffect(() => {
    if (!token) return
    // Kick off the first fetch on a zero-delay timer so React's effect body
    // itself does no state updates (keeps react-hooks/set-state-in-effect happy).
    const initial = window.setTimeout(() => {
      void refreshPendingCount()
    }, 0)
    pollRef.current = window.setInterval(() => {
      void refreshPendingCount()
    }, PENDING_POLL_MS)
    return () => {
      window.clearTimeout(initial)
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [token, refreshPendingCount])

  const payload: TokenPayload | null = useMemo(() => {
    return token ? decodeJwt(token) : null
  }, [token])

  const onLoginSuccess = useCallback((tk: string) => {
    setTokenState(tk)
    setSessionNotice(null)
  }, [])

  const onLogout = useCallback(() => {
    clearToken()
    setTokenState(null)
    setSessionNotice(null)
  }, [])

  const footerMeta = status ? (
    <>
      {t.projectName}
      <span className="footer-sep" aria-hidden>
        |
      </span>
      {`${t.apiVersion} v${status.version}`}
      {status.maintenance ? ` · ${t.maintenanceSuffix}` : ''}
    </>
  ) : null

  if (!token) {
    return (
      <div className="app app--auth" data-theme={theme}>
        <header className="top-bar top-bar--auth">
          <div className="brand">
            <img
              className="brand-mark"
              src={`${import.meta.env.BASE_URL}app-icon.png`}
              alt=""
              aria-hidden
            />
            <span className="brand-text">{t.brand}</span>
          </div>
          <div className="header-controls">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggle}
              aria-pressed={theme === 'dark'}
            >
              {theme === 'light' ? t.themeToDark : t.themeToLight}
            </button>
          </div>
        </header>
        {sessionNotice ? (
          <div className="session-notice" role="status">
            {sessionNotice}
          </div>
        ) : null}
        <LoginView t={t} onSuccess={onLoginSuccess} />
        <footer className="site-footer">
          <a
            className="footer-github"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon width={16} height={16} aria-hidden />
            <span>{t.viewOnGitHub}</span>
          </a>
          <span className="footer-meta">{footerMeta}</span>
        </footer>
      </div>
    )
  }

  return (
    <div
      className={
        'app app--dashboard' + (isNarrow && sidebarOpen ? ' sidebar-open' : '')
      }
      data-theme={theme}
    >
      {isNarrow && sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={t.a11yCloseNavMenu}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        id="dashboard-sidebar"
        className="app-sidebar"
        aria-label={t.a11yMainNav}
        {...(isNarrow && !sidebarOpen ? { inert: true } : {})}
      >
        <div className="sidebar-brand">
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}app-icon.png`}
            alt=""
            aria-hidden
          />
          <span className="brand-text">{t.brand}</span>
        </div>

        <nav className="sidebar-nav" aria-label="Sections">
          {TAB_GROUPS.map((group) => (
            <div className="sidebar-group" key={group.id}>
              <span className="sidebar-group-label" aria-hidden>
                {t[group.labelKey]}
              </span>
              <div className="sidebar-group-items" role="group" aria-label={t[group.labelKey]}>
                {group.tabs.map((tab) => {
                  const badge =
                    tab === 'pending' && pendingCount && pendingCount > 0
                      ? pendingCount
                      : null
                  return (
                    <button
                      key={tab}
                      type="button"
                      data-tab={tab}
                      className={'sidebar-link ' + (activeTab === tab ? 'is-active' : '')}
                      onClick={() => {
                        setActiveTab(tab)
                        if (isNarrow) setSidebarOpen(false)
                      }}
                      aria-current={activeTab === tab ? 'page' : undefined}
                    >
                      <span className="sidebar-link-icon" aria-hidden>
                        {tabIcon(tab)}
                      </span>
                      <span className="sidebar-link-label">{tabLabel(tab, t)}</span>
                      {badge != null ? (
                        <span
                          className="sidebar-link-badge"
                          aria-label={`${badge} ${t.navPending}`}
                        >
                          {badge > 99 ? '99+' : badge}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          {payload ? (
            <div className="sidebar-user" title={`${t.signedInAs} ${payload.username}`}>
              <Avatar name={payload.username} size={36} />
              <div className="sidebar-user-meta">
                <span className="sidebar-user-label">{t.signedInAs}</span>
                <span className="sidebar-user-name">{payload.username}</span>
              </div>
            </div>
          ) : null}
          <div className="sidebar-controls">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggle}
              aria-pressed={theme === 'dark'}
              title={theme === 'light' ? t.themeToDark : t.themeToLight}
            >
              {theme === 'light' ? t.themeToDark : t.themeToLight}
            </button>
          </div>
          <button
            type="button"
            className="btn btn--danger-soft btn--sm sidebar-logout"
            onClick={onLogout}
            title={t.logout}
          >
            <LogoutIcon width={14} height={14} />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-nav-bar">
          <button
            type="button"
            className="icon-btn mobile-menu-btn"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-expanded={sidebarOpen}
            aria-controls="dashboard-sidebar"
            aria-label={sidebarOpen ? t.a11yCloseNavMenu : t.a11yOpenNavMenu}
          >
            <MenuIcon width={20} height={20} className="mobile-menu-icon" />
          </button>
          <span className="mobile-nav-title">{tabLabel(activeTab, t)}</span>
        </header>
        {status?.maintenance ? (
          <div className="banner">
            <strong>{t.maintenanceSuffix}</strong> · {t.maintenanceBanner}
          </div>
        ) : null}
        {statusError ? (
          <div className="banner banner--error" role="alert">
            <strong>{t.connectionProblem}</strong> · {statusError}
          </div>
        ) : null}

        <main className="main-shell">
          {activeTab === 'services' && <ServicesView t={t} />}
          {activeTab === 'pending' && (
            <PendingView t={t} lang="en" onPendingChanged={refreshPendingCount} />
          )}
          {activeTab === 'connections' && <ConnectionsView t={t} lang="en" />}
          {activeTab === 'ignored' && <IgnoredView t={t} />}
          {activeTab === 'webhooks' && <WebhooksView t={t} />}
        </main>

        <footer className="site-footer">
          <a
            className="footer-github"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon width={16} height={16} aria-hidden />
            <span>{t.viewOnGitHub}</span>
          </a>
          <span className="footer-meta">{footerMeta}</span>
        </footer>
      </div>
    </div>
  )
}

function tabLabel(tab: Tab, t: typeof strings['en']): string {
  switch (tab) {
    case 'services':
      return t.navServices
    case 'pending':
      return t.navPending
    case 'connections':
      return t.navConnections
    case 'ignored':
      return t.navIgnored
    case 'webhooks':
      return t.navWebhooks
  }
}
