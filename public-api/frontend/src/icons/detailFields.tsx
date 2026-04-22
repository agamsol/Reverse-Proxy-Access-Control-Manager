import type { FC, SVGProps } from 'react'

/**
 * Supplementary form glyphs — same conventions as contactFields (fill currentColor, 24×24).
 */

export const DetailCalendarIcon: FC<SVGProps<SVGSVGElement>> = ({
  className = 'size-6',
  ...props
}) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    {...props}
  >
    <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 1.99 2H19c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2h-1V1h-2zm3 18H5V8h14v11z" />
  </svg>
)

export const DetailNoteIcon: FC<SVGProps<SVGSVGElement>> = ({
  className = 'size-6',
  ...props
}) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    {...props}
  >
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2zm-4 11H8v-2h8v2zm0-3H8V8h8v2z" />
  </svg>
)
