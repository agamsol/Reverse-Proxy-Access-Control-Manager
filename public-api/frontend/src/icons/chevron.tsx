import type { FC, SVGProps } from 'react'

/** Outlined chevrons (same SVG style as @iconstack/react icon components; package has no chevron exports). */
export const ChevronUpIcon: FC<SVGProps<SVGSVGElement>> = ({
  className = 'size-6',
  ...props
}) => (
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
    {...props}
  >
    <path d="M18 15l-6-6-6 6" />
  </svg>
)

export const ChevronDownIcon: FC<SVGProps<SVGSVGElement>> = ({
  className = 'size-6',
  ...props
}) => (
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
    {...props}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)
