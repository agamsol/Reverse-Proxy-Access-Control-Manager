import type { FC, ReactNode, SVGProps } from 'react'

/**
 * Outlined glyphs matching @iconstack/react conventions (stroke="currentColor",
 * 24×24 viewBox). Kept small and consistent so they compose well in buttons.
 */

type IconProps = SVGProps<SVGSVGElement>

function baseStroke(props: IconProps, path: ReactNode) {
  const { className = 'size-6', ...rest } = props
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {path}
    </svg>
  )
}

export const ChevronUpIcon: FC<IconProps> = (p) => baseStroke(p, <path d="M18 15l-6-6-6 6" />)
export const ChevronDownIcon: FC<IconProps> = (p) =>
  baseStroke(p, <path d="M6 9l6 6 6-6" />)
export const ChevronLeftIcon: FC<IconProps> = (p) =>
  baseStroke(p, <path d="M15 18l-6-6 6-6" />)
export const ChevronRightIcon: FC<IconProps> = (p) =>
  baseStroke(p, <path d="M9 6l6 6-6 6" />)

export const MenuIcon: FC<IconProps> = (p) =>
  baseStroke(p, <path d="M4 6h16M4 12h16M4 18h16" />)

export const PlusIcon: FC<IconProps> = (p) => baseStroke(p, <path d="M12 5v14M5 12h14" />)
export const CheckIcon: FC<IconProps> = (p) => baseStroke(p, <path d="M5 13l4 4L19 7" />)
export const XIcon: FC<IconProps> = (p) => baseStroke(p, <path d="M6 6l12 12M18 6L6 18" />)
export const RefreshIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <path d="M4 4v6h6" />
      <path d="M20 20v-6h-6" />
      <path d="M20 9A8 8 0 0 0 6.3 5.7L4 8" />
      <path d="M4 15a8 8 0 0 0 13.7 3.3L20 16" />
    </>,
  )
export const PencilIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </>,
  )
export const TrashIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>,
  )
export const ServerIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 7h.01M7 17h.01" />
    </>,
  )
export const ClockIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  )
export const ShieldIcon: FC<IconProps> = (p) =>
  baseStroke(p, <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />)
export const BanIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.64 5.64l12.72 12.72" />
    </>,
  )
export const WebhookIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 1 1 2 17c.01-.7.2-1.4.57-2" />
      <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
      <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8" />
    </>,
  )
export const GitHubIcon: FC<IconProps> = ({ className = 'size-6', ...props }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
    {...props}
  >
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
)
export const SearchIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>,
  )
export const UserIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>,
  )
export const MailIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>,
  )
export const PhoneIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <path d="M22 16.92V21a1 1 0 0 1-1.1 1 19 19 0 0 1-8.28-3.07 19 19 0 0 1-6-6A19 19 0 0 1 3.55 4.1 1 1 0 0 1 4.54 3h4.09a1 1 0 0 1 1 .75 11.7 11.7 0 0 0 .61 2.54 1 1 0 0 1-.24 1L8.1 9.2a16 16 0 0 0 6.7 6.7l1.9-1.9a1 1 0 0 1 1-.24 11.7 11.7 0 0 0 2.54.61 1 1 0 0 1 .76 1z" />,
  )
export const PinIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <path d="M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>,
  )
export const EyeIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  )
export const EyeOffIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 4.22-5.19" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.9 19.9 0 0 1-3.17 4.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </>,
  )
export const LogoutIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>,
  )
export const CopyIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>,
  )
export const ExternalLinkIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </>,
  )
export const BookIcon: FC<IconProps> = (p) =>
  baseStroke(
    p,
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>,
  )
