import { useState, type ReactNode } from 'react'
import { HttpError } from '../api'
import { Modal } from './Modal'

type ConfirmDialogProps = {
  open: boolean
  title: string
  children: ReactNode
  labelConfirm: string
  labelCancel: string
  labelBusy: string
  labelClose: string
  danger?: boolean
  onConfirm: () => Promise<unknown> | void
  onClose: () => void
}

/** Generic busy-aware confirm dialog; surfaces API errors inline. */
export function ConfirmDialog({
  open,
  title,
  children,
  labelConfirm,
  labelCancel,
  labelBusy,
  labelClose,
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      setBusy(false)
    } catch (e) {
      setBusy(false)
      setError(e instanceof HttpError ? e.detail || e.message : (e as Error).message)
    }
  }

  const handleClose = () => {
    if (busy) return
    setError(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      labelClose={labelClose}
      busy={busy}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={handleClose}
            disabled={busy}
          >
            {labelCancel}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? labelBusy : labelConfirm}
          </button>
        </>
      }
    >
      <div className="confirm-body">
        {children}
        {error ? (
          <p className="feedback error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
