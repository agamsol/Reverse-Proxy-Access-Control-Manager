import { useEffect, useId } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '../icons'
import type { Messages } from '../i18n'
import { fmt } from '../format'
import { DEFAULT_PAGE_SIZE_OPTIONS } from './pagination-utils'

type PaginationProps = {
  total: number
  page: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
  t: Messages
  pageSizeOptions?: readonly number[]
  /** Visual placement — tweaks padding/borders to sit above or below a list. */
  variant?: 'top' | 'bottom'
}

export function Pagination({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
  t,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  variant = 'bottom',
}: PaginationProps) {
  const selectId = useId()
  const safeSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(total / safeSize))
  const safePage = Math.min(Math.max(1, page), totalPages)

  // Clamp the external state if it's out of range (e.g. list shrank after a delete).
  useEffect(() => {
    if (safePage !== page) onPage(safePage)
  }, [safePage, page, onPage])

  const from = total === 0 ? 0 : (safePage - 1) * safeSize + 1
  const to = Math.min(total, safePage * safeSize)

  const pageNumbers = buildPageList(safePage, totalPages)

  return (
    <div
      className={'pagination pagination--' + variant}
      role="navigation"
      aria-label="Pagination"
    >
      <div className="pagination-info">
        {total === 0
          ? fmt(t.paginationTotal, { total })
          : fmt(t.paginationShowing, { from, to, total })}
      </div>

      <div className="pagination-size">
        <label htmlFor={selectId} className="pagination-size-label">
          {t.pageSizeLabel}
        </label>
        <select
          id={selectId}
          className="pagination-size-select"
          value={safeSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="pagination-pager">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPage(safePage - 1)}
          disabled={safePage <= 1}
          aria-label={t.paginationPrev}
        >
          <ChevronLeftIcon width={14} height={14} />
        </button>

        <ul className="pagination-pages" role="list">
          {pageNumbers.map((entry, idx) =>
            entry === 'ellipsis' ? (
              <li key={`e-${idx}`} className="pagination-ellipsis" aria-hidden>
                …
              </li>
            ) : (
              <li key={entry}>
                <button
                  type="button"
                  className={
                    'pagination-btn pagination-page' +
                    (entry === safePage ? ' is-active' : '')
                  }
                  onClick={() => onPage(entry)}
                  aria-current={entry === safePage ? 'page' : undefined}
                  aria-label={fmt(t.paginationPage, { page: entry, total: totalPages })}
                >
                  {entry}
                </button>
              </li>
            ),
          )}
        </ul>

        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPage(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label={t.paginationNext}
        >
          <ChevronRightIcon width={14} height={14} />
        </button>
      </div>
    </div>
  )
}

type PageEntry = number | 'ellipsis'

function buildPageList(current: number, total: number): PageEntry[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const out: PageEntry[] = [1]
  const window = 1
  const start = Math.max(2, current - window)
  const end = Math.min(total - 1, current + window)
  if (start > 2) out.push('ellipsis')
  for (let p = start; p <= end; p++) out.push(p)
  if (end < total - 1) out.push('ellipsis')
  out.push(total)
  return out
}

