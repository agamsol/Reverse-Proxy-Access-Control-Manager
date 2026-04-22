import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  message: string
  action?: ReactNode
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? (
        <span className="empty-state-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <p>{message}</p>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  )
}
