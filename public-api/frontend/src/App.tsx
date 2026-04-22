import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { GitHubIcon } from '@iconstack/react'
import { ContactEmailIcon, ContactNameIcon, ContactPhoneIcon } from './icons/contactFields'
import { DetailCalendarIcon, DetailNoteIcon } from './icons/detailFields'
import { ChevronDownIcon, ChevronUpIcon } from './icons/chevron'
import { TrashIcon } from './icons/trash'
import {
  checkDestinationAccess,
  getContactFieldsConfig,
  getServices,
  getStatus,
  submitAccessRequest,
  type AccessCheckResponse,
  type ContactFieldsConfig,
  type ServiceInfo,
  type StatusInfo,
} from './api'
import { strings, type Lang } from './i18n'
import './App.css'

const THEME_KEY = 'guest-portal-theme'
const LANG_KEY = 'guest-portal-lang'
const GITHUB_URL = 'https://github.com/agamsol/Reverse-Proxy-Access-Control-Manager'

type GeoStatus = 'idle' | 'prompting' | 'ok' | 'denied'
type ModalKind = null | 'how' | 'request' | 'success'
type CheckStatus = 'idle' | 'checking' | 'granted' | 'blocked' | 'error'
type FormSectionId = 'contact' | 'services' | 'details'

type ResponseState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'http'; status: number; statusText: string }
  | { kind: 'network' }

function statusClass(code: number): 'info' | 'ok' | 'redirect' | 'warn' | 'error' | 'neutral' {
  if (code >= 200 && code < 300) return 'ok'
  if (code >= 300 && code < 400) return 'redirect'
  if (code >= 400 && code < 500) return 'warn'
  if (code >= 500 && code < 600) return 'error'
  if (code >= 100 && code < 200) return 'info'
  return 'neutral'
}

function defaultStatusText(code: number): string {
  if (code >= 200 && code < 300) return 'OK'
  if (code >= 300 && code < 400) return 'Redirect'
  if (code >= 400 && code < 500) return 'Client error'
  if (code >= 500 && code < 600) return 'Server error'
  if (code >= 100 && code < 200) return 'Info'
  return ''
}

type ResponseBadgeProps = {
  state: ResponseState
  labelPending: string
  labelNetwork: string
  labelPrefix: string
}

function ResponseBadge({ state, labelPending, labelNetwork, labelPrefix }: ResponseBadgeProps) {
  if (state.kind === 'idle') return null
  if (state.kind === 'pending') {
    return (
      <span className="response-badge response-badge--pending" role="status" aria-live="polite">
        <span className="response-badge-dot" aria-hidden />
        <span className="response-badge-code">{labelPending}</span>
      </span>
    )
  }
  if (state.kind === 'network') {
    return (
      <span className="response-badge response-badge--neutral" role="status" aria-live="polite">
        <span className="response-badge-label">{labelPrefix}</span>
        <span className="response-badge-code">{labelNetwork}</span>
      </span>
    )
  }
  const cls = statusClass(state.status)
  const text = state.statusText || defaultStatusText(state.status)
  return (
    <span
      className={`response-badge response-badge--${cls}`}
      role="status"
      aria-live="polite"
      title={`HTTP ${state.status}${text ? ` ${text}` : ''}`}
    >
      <span className="response-badge-label">{labelPrefix}</span>
      <span className="response-badge-code">{state.status}</span>
      {text ? <span className="response-badge-text">{text}</span> : null}
    </span>
  )
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage === 'undefined') return 'light'
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((v) => (v === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, toggle }
}

function useLang() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof localStorage === 'undefined') return 'en'
    const stored = localStorage.getItem(LANG_KEY)
    return stored === 'he' ? 'he' : 'en'
  })

  useEffect(() => {
    document.documentElement.lang = lang === 'he' ? 'he' : 'en'
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
    localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  return { lang, setLang }
}

function nullIfEmpty(s: string): string | null {
  const v = s.trim()
  return v === '' ? null : v
}

/** Value for `input type="datetime-local"` in the browser's local time zone. */
function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse `datetime-local` string as an instant in local time. */
function parseDatetimeLocalToDate(value: string): Date | null {
  const v = value.trim()
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const h = Number(m[4])
  const mi = Number(m[5])
  if ([y, mo, d, h, mi].some((n) => !Number.isFinite(n))) return null
  return new Date(y, mo - 1, d, h, mi, 0, 0)
}

function formatRelativeTimeToFuture(target: Date, lang: Lang): string {
  const diffSec = (target.getTime() - Date.now()) / 1000
  if (diffSec <= 0) return ''
  const locale = lang === 'he' ? 'he' : 'en'
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (diffSec < 60) return rtf.format(Math.round(diffSec), 'second')
  const diffMin = diffSec / 60
  if (diffMin < 60) return rtf.format(Math.round(diffMin), 'minute')
  const diffHour = diffMin / 60
  if (diffHour < 24) return rtf.format(Math.round(diffHour), 'hour')
  const diffDay = diffHour / 24
  if (diffDay < 30) return rtf.format(Math.round(diffDay), 'day')
  const diffMonth = diffDay / 30
  if (diffMonth < 12) return rtf.format(Math.round(diffMonth), 'month')
  return rtf.format(Math.round(diffDay / 365), 'year')
}

function parseRedirectTarget(): URL | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('redirect')
  if (!raw) return null
  try {
    const url = new URL(raw, window.location.origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '')
}

function findMatchingService(services: ServiceInfo[], target: URL): ServiceInfo | null {
  const host = target.hostname.toLowerCase()
  for (const s of services) {
    const candidates = [s.name, s.internal_address]
    for (const c of candidates) {
      if (!c) continue
      const n = normalizeHost(c)
      if (!n) continue
      if (n === host) return s
    }
  }
  return null
}

const UNCATEGORIZED_KEY = '__uncategorized__'

function serviceCategoryKey(s: ServiceInfo): string {
  const c = s.category?.trim()
  return c ? c : UNCATEGORIZED_KEY
}

function serviceMatchesQuery(s: ServiceInfo, q: string): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  if (s.name.toLowerCase().includes(n)) return true
  if (s.description?.toLowerCase().includes(n)) return true
  if (String(s.internal_address).toLowerCase().includes(n)) return true
  if (s.category?.toLowerCase().includes(n)) return true
  return false
}

function sortServicesWithSelectedFirst(list: ServiceInfo[], selected: Set<string>): ServiceInfo[] {
  return [...list].sort((a, b) => {
    const aOn = selected.has(a.name)
    const bOn = selected.has(b.name)
    if (aOn !== bOn) return aOn ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

function groupServicesByCategory(list: ServiceInfo[]): { key: string; services: ServiceInfo[] }[] {
  const m = new Map<string, ServiceInfo[]>()
  for (const s of list) {
    const k = serviceCategoryKey(s)
    const g = m.get(k)
    if (g) g.push(s)
    else m.set(k, [s])
  }
  const keys = [...m.keys()]
  keys.sort((a, b) => {
    if (a === UNCATEGORIZED_KEY) return 1
    if (b === UNCATEGORIZED_KEY) return -1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
  return keys.map((key) => ({ key, services: m.get(key)! }))
}

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  labelClose: string
  size?: 'md' | 'lg'
  children: ReactNode
  footer?: ReactNode
}

function LocationPinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
        fill="currentColor"
      />
    </svg>
  )
}

function RequiredMark({ label }: { label: string }) {
  return (
    <span className="required-mark" title={label} aria-label={label}>
      *
    </span>
  )
}

function OptionalMark({ label }: { label: string }) {
  return <span className="optional-mark"> {label}</span>
}

function FieldRequirementMark({
  required,
  requiredLabel,
  optionalLabel,
}: {
  required: boolean
  requiredLabel: string
  optionalLabel: string
}) {
  if (required) return <RequiredMark label={requiredLabel} />
  return <OptionalMark label={optionalLabel} />
}

function Modal({ open, onClose, title, labelClose, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onMouseDown={onClose} role="presentation">
      <div
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={labelClose}>
            <span aria-hidden>×</span>
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>
  )
}

export default function App() {
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useLang()
  const t = strings[lang]

  const redirectTarget = useMemo(() => parseRedirectTarget(), [])
  const redirectHasRaw = useMemo(() => {
    if (typeof window === 'undefined') return false
    return !!new URLSearchParams(window.location.search).get('redirect')
  }, [])
  const redirectInvalid = redirectHasRaw && !redirectTarget

  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [services, setServices] = useState<ServiceInfo[] | null>(null)
  const [contactFieldsConfig, setContactFieldsConfig] = useState<ContactFieldsConfig>({
    name: { visible: true, required: false },
    email: { visible: true, required: false },
    phone_number: { visible: true, required: false },
  })
  const [loadError, setLoadError] = useState<string | null>(null)

  const [modal, setModal] = useState<ModalKind>(null)
  const lastSuccessRef = useRef<string>('')

  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [accessUntilLocal, setAccessUntilLocal] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [geoErrorCode, setGeoErrorCode] = useState<number | null>(null)
  /** After explicit detach, skip auto `getCurrentPosition` while permission is still granted. */
  const skipAutoLocationAfterDetachRef = useRef(false)
  const wasRequestModalRef = useRef(false)

  const isSecureContext = useMemo(() => {
    if (typeof window === 'undefined') return true
    return !!window.isSecureContext
  }, [])

  const geolocationAvailable = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    return !!navigator.geolocation && isSecureContext
  }, [isSecureContext])

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [serviceQuery, setServiceQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => new Set())
  const [formSectionsCollapsed, setFormSectionsCollapsed] = useState<Set<FormSectionId>>(
    () => new Set(),
  )

  const [checkStatus, setCheckStatus] = useState<CheckStatus>('idle')
  const [checkResponse, setCheckResponse] = useState<ResponseState>({ kind: 'idle' })
  const autoSelectedRef = useRef(false)

  useEffect(() => {
    document.title = t.title
  }, [t.title])

  useEffect(() => {
    if (modal !== 'request') {
      setServiceQuery('')
      setCollapsedCategories(new Set())
      setFormSectionsCollapsed(new Set())
    }
  }, [modal])

  const toggleFormSection = useCallback((id: FormSectionId) => {
    setFormSectionsCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleCategoryCollapsed = useCallback((key: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const filteredServices = useMemo(() => {
    if (!services) return []
    const q = serviceQuery.trim()
    if (!q) return services
    return services.filter((s) => serviceMatchesQuery(s, serviceQuery))
  }, [services, serviceQuery])

  const serviceGroups = useMemo(
    () => groupServicesByCategory(filteredServices),
    [filteredServices],
  )

  useEffect(() => {
    if (autoSelectedRef.current) return
    if (!services || !redirectTarget) return
    const match = findMatchingService(services, redirectTarget)
    if (!match) return
    autoSelectedRef.current = true
    setSelected((prev) => {
      if (prev.has(match.name)) return prev
      const next = new Set(prev)
      next.add(match.name)
      return next
    })
  }, [services, redirectTarget])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [st, sv] = await Promise.all([getStatus(), getServices()])
        if (!cancelled) {
          setStatus(st)
          setServices(sv)
          setLoadError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not reach the server.')
        }
      }

      // Contact-field requirements are a soft dependency: if the config
      // endpoint is unreachable we keep the defaults (all optional) rather
      // than blocking the whole page.
      try {
        const cfg = await getContactFieldsConfig()
        if (!cancelled) setContactFieldsConfig(cfg)
      } catch {
        // Ignore; defaults already set.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleService = (nameVal: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(nameVal)) next.delete(nameVal)
      else next.add(nameVal)
      return next
    })
    setFormError(null)
  }

  const onAccessUntilChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      if (!v.trim()) {
        setAccessUntilLocal('')
        setFormError(null)
        return
      }
      setAccessUntilLocal(v)
      const d = parseDatetimeLocalToDate(v)
      if (!d || d.getTime() <= Date.now()) {
        setFormError(t.errDuration)
        return
      }
      setFormError(null)
    },
    [t.errDuration],
  )

  const expiryParsed = useMemo((): number | null | undefined => {
    const s = accessUntilLocal.trim()
    if (s === '') return null
    const end = parseDatetimeLocalToDate(s)
    if (!end) return undefined
    const diffMs = end.getTime() - Date.now()
    if (diffMs <= 0) return undefined
    return Math.max(1, Math.ceil(diffMs / 60_000))
  }, [accessUntilLocal])

  const accessUntilEndSummary = useMemo((): { text: string } | null => {
    const s = accessUntilLocal.trim()
    if (!s) return null
    const end = parseDatetimeLocalToDate(s)
    if (!end || end.getTime() <= Date.now()) return null
    const rel = formatRelativeTimeToFuture(end, lang)
    if (!rel) return null
    return { text: strings[lang].accessUntilAfterApproval.replace('{relative}', rel) }
  }, [accessUntilLocal, lang])

  const requestLocation = useCallback(
    (silent = false) => {
      if (!navigator.geolocation) {
        if (!silent) setFormError(t.errGeoUnsupported)
        setGeoStatus('denied')
        setGeoErrorCode(null)
        return
      }
      if (!silent) setFormError(null)
      skipAutoLocationAfterDetachRef.current = false
      setGeoStatus('prompting')
      setGeoErrorCode(null)
      // getCurrentPosition must be invoked inside the user-gesture call stack
      // for iOS Safari to show the permission prompt; keep this call
      // synchronous within the click handler.
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
          setGeoStatus('ok')
          setGeoErrorCode(null)
        },
        (err) => {
          setGeoCoords(null)
          setGeoStatus('denied')
          setGeoErrorCode(err?.code ?? null)
        },
        { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
      )
    },
    [t.errGeoUnsupported],
  )

  const detachLocation = useCallback(() => {
    setFormError(null)
    setGeoCoords(null)
    setGeoErrorCode(null)
    setGeoStatus('idle')
    skipAutoLocationAfterDetachRef.current = true
  }, [])

  const onLocationAttachButton = useCallback(() => {
    if (geoStatus === 'ok') {
      detachLocation()
    } else {
      requestLocation(false)
    }
  }, [geoStatus, detachLocation, requestLocation])

  useEffect(() => {
    if (modal === 'request' && !wasRequestModalRef.current) {
      skipAutoLocationAfterDetachRef.current = false
    }
    wasRequestModalRef.current = modal === 'request'
  }, [modal])

  useEffect(() => {
    if (modal !== 'request') return
    if (geoStatus !== 'idle') return
    if (!geolocationAvailable) return
    if (skipAutoLocationAfterDetachRef.current) return
    const permApi = (
      navigator as Navigator & {
        permissions?: { query: (d: PermissionDescriptor) => Promise<PermissionStatus> }
      }
    ).permissions
    if (!permApi?.query) return
    let cancelled = false
    permApi
      .query({ name: 'geolocation' as PermissionName })
      .then((perm) => {
        if (cancelled) return
        if (perm.state === 'granted') {
          requestLocation(true)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [modal, geoStatus, requestLocation, geolocationAvailable])

  const resetForm = () => {
    setSelected(new Set())
    setAccessUntilLocal('')
    setName('')
    setEmail('')
    setPhone('')
    setNote('')
    setGeoStatus('idle')
    setGeoCoords(null)
    setGeoErrorCode(null)
    setFormError(null)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (selected.size === 0) {
      setFormError(t.errSelectService)
      return
    }
    if (expiryParsed === undefined) {
      setFormError(t.errDuration)
      return
    }

    const missingContactLabels: string[] = []
    if (contactFieldsConfig.name.visible && contactFieldsConfig.name.required && !nullIfEmpty(name)) {
      missingContactLabels.push(t.nameLabel)
    }
    if (contactFieldsConfig.email.visible && contactFieldsConfig.email.required && !nullIfEmpty(email)) {
      missingContactLabels.push(t.emailLabel)
    }
    if (
      contactFieldsConfig.phone_number.visible &&
      contactFieldsConfig.phone_number.required &&
      !nullIfEmpty(phone)
    ) {
      missingContactLabels.push(t.phoneLabel)
    }
    if (missingContactLabels.length > 0) {
      setFormError(t.errRequiredContact.replace('{fields}', missingContactLabels.join(', ')))
      return
    }

    let lat: number | null = null
    let lon: number | null = null
    if (geoStatus === 'ok' && geoCoords) {
      lat = geoCoords.lat
      lon = geoCoords.lon
    }

    const payload = {
      services: [...selected].map((n) => ({ name: n, expiry: expiryParsed })),
      contact_methods: {
        name: contactFieldsConfig.name.visible ? nullIfEmpty(name) : null,
        email: contactFieldsConfig.email.visible ? nullIfEmpty(email) : null,
        phone_number: contactFieldsConfig.phone_number.visible ? nullIfEmpty(phone) : null,
      },
      note: nullIfEmpty(note),
      location: { lat, lon },
    }

    setSubmitting(true)
    try {
      const res = await submitAccessRequest(payload)
      lastSuccessRef.current = res.data.message
      resetForm()
      setModal('success')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const locationStatusText = useMemo(() => {
    if (geoStatus === 'ok') return t.locationAcquired
    if (geoStatus === 'prompting') return t.locationRequesting
    if (geoStatus === 'denied') {
      switch (geoErrorCode) {
        case 1:
          return t.locationDeniedByUser
        case 2:
          return t.locationUnavailable
        case 3:
          return t.locationTimeout
        default:
          return t.locationDenied
      }
    }
    return t.locationIdle
  }, [geoStatus, geoErrorCode, t])

  const runAccessCheck = useCallback(async () => {
    if (!redirectTarget) return
    setCheckStatus('checking')
    setCheckResponse({ kind: 'pending' })
    const response: AccessCheckResponse = await checkDestinationAccess(redirectTarget.href)
    if (response.result === 'unknown') {
      setCheckResponse({ kind: 'network' })
    } else {
      setCheckResponse({
        kind: 'http',
        status: response.status,
        statusText: response.statusText,
      })
    }
    if (response.result === 'granted') setCheckStatus('granted')
    else if (response.result === 'blocked') setCheckStatus('blocked')
    else setCheckStatus('error')
  }, [redirectTarget])

  const goToDestination = useCallback(() => {
    if (!redirectTarget) return
    window.location.href = redirectTarget.href
  }, [redirectTarget])

  const checkStatusMessage = useMemo(() => {
    switch (checkStatus) {
      case 'checking':
        return t.checkingAccess
      case 'granted':
        return t.accessGranted
      case 'blocked':
        return t.accessNotYet
      case 'error':
        return t.accessCheckError
      default:
        return ''
    }
  }, [checkStatus, t])

  const ctaDisabled = !!loadError || services === null

  return (
    <div className="app">
      <div className="shell">
        <header className="top-bar">
          <div className="brand">
            <img
              className="brand-mark"
              src={`${import.meta.env.BASE_URL}app-icon.png`}
              alt=""
              aria-hidden
            />
            <span className="brand-text">{t.title}</span>
          </div>

          <div className="header-controls">
            <div className="lang-switch" role="group" aria-label="Language">
              <button
                type="button"
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
              <button
                type="button"
                className={`lang-btn ${lang === 'he' ? 'active' : ''}`}
                onClick={() => setLang('he')}
                aria-pressed={lang === 'he'}
              >
                עב
              </button>
            </div>
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

        <main className="hero">
          <div className="hero-inner">
            <span className="hero-badge">{t.subtitleRedirect}</span>
            <h1 className="hero-title">{t.title}</h1>
            <p className="hero-lede">{t.heroLede}</p>

            {status?.maintenance ? (
              <div className="banner" role="status">
                {t.maintenanceBanner}
              </div>
            ) : null}
            {loadError ? (
              <div className="banner banner--error" role="alert">
                <strong>{t.connectionProblem}</strong> · {loadError}
              </div>
            ) : null}
            {redirectInvalid ? (
              <div className="banner banner--error" role="alert">
                {t.invalidRedirect}
              </div>
            ) : null}

            <div className="hero-actions">
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => setModal('request')}
                disabled={ctaDisabled}
              >
                {t.ctaRequest}
              </button>
              <button type="button" className="btn btn--quiet" onClick={() => setModal('how')}>
                {t.howItWorks}
              </button>
            </div>

            {redirectTarget ? (
              <div className={`destination destination--${checkStatus}`}>
                <div className="destination-row">
                  <span className="destination-label">{t.destinationLabel}</span>
                  <span className="destination-url" title={redirectTarget.href}>
                    {redirectTarget.host}
                    {redirectTarget.pathname !== '/' ? redirectTarget.pathname : ''}
                  </span>
                </div>
                <div className="destination-actions">
                  <ResponseBadge
                    state={checkResponse}
                    labelPending={t.responsePending}
                    labelNetwork={t.responseNetwork}
                    labelPrefix={t.responseCode}
                  />
                  {checkStatus === 'granted' ? (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={goToDestination}
                    >
                      {t.continueTo} ↗
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--quiet btn--sm"
                      onClick={runAccessCheck}
                      disabled={checkStatus === 'checking'}
                    >
                      {checkStatus === 'checking' ? t.checkingAccess : t.checkAccess}
                    </button>
                  )}
                </div>
                {checkStatusMessage && checkStatus !== 'idle' ? (
                  <p className={`destination-feedback destination-feedback--${checkStatus}`}>
                    {checkStatusMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </main>

        <footer className="site-footer">
          <a className="footer-github" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <GitHubIcon width={18} height={18} aria-hidden />
            <span>{t.viewOnGitHub}</span>
          </a>
          <span className="footer-meta">
            {status ? (
              <>
                {t.projectName}
                <span className="footer-sep" aria-hidden="true">|</span>
                {`${t.apiVersion} v${status.version}`}
              </>
            ) : ''}
            {status?.maintenance ? ` · ${t.maintenanceSuffix}` : ''}
          </span>
        </footer>
      </div>

      <Modal
        open={modal === 'how'}
        onClose={() => setModal(null)}
        title={t.whatNext}
        labelClose={t.close}
      >
        <ol className="steps">
          <li className="step">
            <span className="step-num" aria-hidden>
              1
            </span>
            <div className="step-body">
              <strong>{t.step1Title}</strong>
              <span>{t.step1Desc}</span>
            </div>
          </li>
          <li className="step">
            <span className="step-num" aria-hidden>
              2
            </span>
            <div className="step-body">
              <strong>{t.step2Title}</strong>
              <span>{t.step2Desc}</span>
            </div>
          </li>
          <li className="step">
            <span className="step-num" aria-hidden>
              3
            </span>
            <div className="step-body">
              <strong>{t.step3Title}</strong>
              <span>{t.step3Desc}</span>
            </div>
          </li>
        </ol>
      </Modal>

      <Modal
        open={modal === 'request'}
        onClose={() => {
          if (!submitting) setModal(null)
        }}
        title={t.requestAccess}
        labelClose={t.close}
        size="lg"
        footer={
          <div className="modal-foot-inner">
            {geolocationAvailable ? (
              <div className="modal-foot-loc" aria-label={t.locationHeading}>
                <button
                  type="button"
                  className={
                    'btn btn--sm loc-btn' +
                    (geoStatus === 'ok' ? ' loc-btn--detach' : ' btn--quiet')
                  }
                  onClick={onLocationAttachButton}
                  disabled={submitting || geoStatus === 'prompting'}
                >
                  <LocationPinIcon />
                  <span>{geoStatus === 'ok' ? t.detachLocation : t.attachLocation}</span>
                </button>
                {geoStatus === 'prompting' || geoStatus === 'denied' ? (
                  <span
                    className={`location-foot-status location-status location-status--${geoStatus}`}
                  >
                    {geoStatus === 'prompting' ? (
                      <span className="loc-status-dot" aria-hidden />
                    ) : null}
                    {locationStatusText}
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="modal-foot-spacer" aria-hidden />
            )}
            <div className="modal-foot-actions">
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setModal(null)}
                disabled={submitting}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                form="access-form"
                className="btn btn--primary"
                disabled={submitting || !!loadError}
              >
                {submitting ? t.submitting : t.reviewSend}
              </button>
            </div>
          </div>
        }
      >
        <form id="access-form" className="access-form" onSubmit={onSubmit}>
          <section className="form-section">
            <div className="form-section-head">
              <h3 className="section-title">{t.contactSection}</h3>
              <div className="form-section-head-actions">
                <button
                  type="button"
                  className="form-section-collapse-btn"
                  onClick={() => toggleFormSection('contact')}
                  aria-expanded={!formSectionsCollapsed.has('contact')}
                  title={
                    formSectionsCollapsed.has('contact')
                      ? `${t.categorySectionExpand} — ${t.contactSection}`
                      : `${t.categorySectionCollapse} — ${t.contactSection}`
                  }
                  aria-label={
                    formSectionsCollapsed.has('contact')
                      ? `${t.categorySectionExpand} — ${t.contactSection}`
                      : `${t.categorySectionCollapse} — ${t.contactSection}`
                  }
                >
                  {formSectionsCollapsed.has('contact') ? (
                    <ChevronDownIcon width={20} height={20} />
                  ) : (
                    <ChevronUpIcon width={20} height={20} />
                  )}
                </button>
              </div>
            </div>
            {formSectionsCollapsed.has('contact') ? null : (
              <div className="form-section-body">
            <div className="field-grid">
              {contactFieldsConfig.name.visible ? (
                <div className="field">
                  <label htmlFor="name" className="label-row">
                    <ContactNameIcon width={14} height={14} aria-hidden />
                    {t.nameLabel}
                    <FieldRequirementMark
                      required={contactFieldsConfig.name.required}
                      requiredLabel={t.requiredField}
                      optionalLabel={t.optionalSuffix}
                    />
                  </label>
                  <input
                    id="name"
                    className="input"
                    autoComplete="name"
                    required={contactFieldsConfig.name.visible && contactFieldsConfig.name.required}
                    aria-required={contactFieldsConfig.name.visible && contactFieldsConfig.name.required}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              ) : null}
              {contactFieldsConfig.email.visible ? (
                <div className="field">
                  <label htmlFor="email" className="label-row">
                    <ContactEmailIcon width={14} height={14} aria-hidden />
                    {t.emailLabel}
                    <FieldRequirementMark
                      required={contactFieldsConfig.email.required}
                      requiredLabel={t.requiredField}
                      optionalLabel={t.optionalSuffix}
                    />
                  </label>
                  <input
                    id="email"
                    className="input"
                    type="email"
                    autoComplete="email"
                    required={contactFieldsConfig.email.visible && contactFieldsConfig.email.required}
                    aria-required={contactFieldsConfig.email.visible && contactFieldsConfig.email.required}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              ) : null}
              {contactFieldsConfig.phone_number.visible ? (
                <div className="field">
                  <label htmlFor="phone" className="label-row">
                    <ContactPhoneIcon width={14} height={14} aria-hidden />
                    {t.phoneLabel}
                    <FieldRequirementMark
                      required={contactFieldsConfig.phone_number.required}
                      requiredLabel={t.requiredField}
                      optionalLabel={t.optionalSuffix}
                    />
                  </label>
                  <input
                    id="phone"
                    className="input"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    pattern="^\+[0-9 .()-]{6,}$"
                    placeholder="+1 555 123 4567"
                    aria-describedby="phone-hint"
                    required={contactFieldsConfig.phone_number.visible && contactFieldsConfig.phone_number.required}
                    aria-required={contactFieldsConfig.phone_number.visible && contactFieldsConfig.phone_number.required}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p id="phone-hint" className="field-hint">{t.phoneHint}</p>
                </div>
              ) : null}
            </div>
              </div>
            )}
          </section>

          <section className="form-section form-section--tight">
            <div className="form-section-head">
              <h3 className="section-title">
                {t.services}
                <RequiredMark label={t.requiredField} />
              </h3>
              <div className="form-section-head-actions">
                <button
                  type="button"
                  className="form-section-collapse-btn"
                  onClick={() => toggleFormSection('services')}
                  aria-expanded={!formSectionsCollapsed.has('services')}
                  title={
                    formSectionsCollapsed.has('services')
                      ? `${t.categorySectionExpand} — ${t.services}`
                      : `${t.categorySectionCollapse} — ${t.services}`
                  }
                  aria-label={
                    formSectionsCollapsed.has('services')
                      ? `${t.categorySectionExpand} — ${t.services}`
                      : `${t.categorySectionCollapse} — ${t.services}`
                  }
                >
                  {formSectionsCollapsed.has('services') ? (
                    <ChevronDownIcon width={20} height={20} />
                  ) : (
                    <ChevronUpIcon width={20} height={20} />
                  )}
                </button>
              </div>
            </div>
            {formSectionsCollapsed.has('services') ? null : (
            <div className="services-panel form-section-body">
              <div className="services-search-bar">
                <div className="services-search-row">
                  {serviceQuery.trim() ? (
                    <button
                      type="button"
                      className="services-cat-icon-btn services-search-clear-btn"
                      onClick={() => setServiceQuery('')}
                      title={t.servicesSearchClear}
                      aria-label={t.servicesSearchClear}
                    >
                      <TrashIcon width={20} height={20} />
                    </button>
                  ) : null}
                  <input
                    type="search"
                    className="input services-search-input"
                    value={serviceQuery}
                    onChange={(e) => setServiceQuery(e.target.value)}
                    placeholder={t.servicesSearchPlaceholder}
                    aria-label={t.servicesSearchPlaceholder}
                  />
                </div>
              </div>
              <div
                className={
                  'services-list-scroll' +
                  (filteredServices.length > 3 ? ' services-list-scroll--max' : '')
                }
                role="group"
                aria-label={t.services}
              >
                {services && services.length === 0 ? (
                  <p className="empty-services">{t.noServices}</p>
                ) : null}
                {services && services.length > 0 && filteredServices.length === 0 ? (
                  <p className="empty-services">{t.servicesNoMatch}</p>
                ) : null}
                {serviceGroups.map(({ key, services: catServices }) => {
                  const isCollapsed = collapsedCategories.has(key)
                  const isUncat = key === UNCATEGORIZED_KEY
                  const label = key
                  const toggleLabel = isCollapsed
                    ? `${t.categorySectionExpand} — ${label}`
                    : `${t.categorySectionCollapse} — ${label}`
                  const renderRows = () =>
                    sortServicesWithSelectedFirst(catServices, selected).map((s) => {
                      const isOn = selected.has(s.name)
                      return (
                        <label
                          key={s.name}
                          className={`service-row ${isOn ? 'is-on' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => toggleService(s.name)}
                          />
                          <span className="service-row-indicator" aria-hidden />
                          <span className="service-row-text">
                            <span className="service-row-main">
                              <span className="service-row-title">{s.name}</span>
                              {s.description ? (
                                <span className="service-row-sub">{s.description}</span>
                              ) : null}
                            </span>
                          </span>
                        </label>
                      )
                    })
                  if (isUncat) {
                    return (
                      <div className="services-category services-category--flat" key={key}>
                        <div className="services-category-body services-category-body--uncat">
                          {renderRows()}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div className="services-category" key={key}>
                      <div className="services-category-head">
                        <span className="services-category-name">{label}</span>
                        <div className="services-category-actions">
                          <button
                            type="button"
                            className="services-cat-collapse-btn"
                            onClick={() => toggleCategoryCollapsed(key)}
                            aria-expanded={!isCollapsed}
                            title={toggleLabel}
                            aria-label={toggleLabel}
                          >
                            {isCollapsed ? <ChevronDownIcon width={20} height={20} /> : <ChevronUpIcon width={20} height={20} />}
                          </button>
                        </div>
                      </div>
                      {isCollapsed ? null : (
                        <div className="services-category-body">{renderRows()}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            )}
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h3 className="section-title">{t.detailsSection}</h3>
              <div className="form-section-head-actions">
                <button
                  type="button"
                  className="form-section-collapse-btn"
                  onClick={() => toggleFormSection('details')}
                  aria-expanded={!formSectionsCollapsed.has('details')}
                  title={
                    formSectionsCollapsed.has('details')
                      ? `${t.categorySectionExpand} — ${t.detailsSection}`
                      : `${t.categorySectionCollapse} — ${t.detailsSection}`
                  }
                  aria-label={
                    formSectionsCollapsed.has('details')
                      ? `${t.categorySectionExpand} — ${t.detailsSection}`
                      : `${t.categorySectionCollapse} — ${t.detailsSection}`
                  }
                >
                  {formSectionsCollapsed.has('details') ? (
                    <ChevronDownIcon width={20} height={20} />
                  ) : (
                    <ChevronUpIcon width={20} height={20} />
                  )}
                </button>
              </div>
            </div>
            {formSectionsCollapsed.has('details') ? null : (
            <div className="form-section-body">
            <div className="field-grid">
            <div className="field">
              <label htmlFor="access-until" className="label-row">
                <DetailCalendarIcon width={14} height={14} aria-hidden />
                {t.accessUntilLabel}
                <OptionalMark label={t.optionalSuffix} />
              </label>
              <input
                id="access-until"
                className="input input-datetime-local"
                type="datetime-local"
                min={toDatetimeLocalValue(new Date())}
                step={60}
                value={accessUntilLocal}
                onChange={onAccessUntilChange}
                aria-label={t.accessUntilLabel}
              />
              {accessUntilEndSummary ? (
                <div className="access-until-embed" role="status">
                  <p className="access-until-embed__text">{accessUntilEndSummary.text}</p>
                </div>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="note" className="label-row">
                <DetailNoteIcon width={14} height={14} aria-hidden />
                {t.noteLabel}
                <OptionalMark label={t.optionalSuffix} />
              </label>
              <input
                id="note"
                className="input"
                maxLength={200}
                placeholder={t.notePlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            </div>
            </div>
            )}
          </section>

          {formError ? (
            <div className="feedback error" role="alert">
              {formError}
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={modal === 'success'}
        onClose={() => setModal(null)}
        title={t.successTitle}
        labelClose={t.close}
        footer={
          redirectTarget ? (
            <>
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setModal(null)}
              >
                {t.done}
              </button>
              {checkStatus === 'granted' ? (
                <button type="button" className="btn btn--primary" onClick={goToDestination}>
                  {t.continueTo} ↗
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={runAccessCheck}
                  disabled={checkStatus === 'checking'}
                >
                  {checkStatus === 'checking' ? t.checkingAccess : t.checkAccess}
                </button>
              )}
            </>
          ) : (
            <button type="button" className="btn btn--primary" onClick={() => setModal(null)}>
              {t.done}
            </button>
          )
        }
      >
        <div className="success-body">
          <div className="success-mark" aria-hidden>
            ✓
          </div>
          <p>{lastSuccessRef.current}</p>
          {redirectTarget ? (
            <ResponseBadge
              state={checkResponse}
              labelPending={t.responsePending}
              labelNetwork={t.responseNetwork}
              labelPrefix={t.responseCode}
            />
          ) : null}
          {redirectTarget && checkStatusMessage && checkStatus !== 'idle' ? (
            <p className={`destination-feedback destination-feedback--${checkStatus}`}>
              {checkStatusMessage}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}
