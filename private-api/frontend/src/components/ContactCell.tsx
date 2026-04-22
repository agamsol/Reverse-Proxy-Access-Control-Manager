import { isEmailVerified, isPhoneVerified, primaryEmail, primaryPhone } from '../api'
import type { ContactMethods } from '../api'
import { CheckIcon, MailIcon, PhoneIcon, UserIcon, XIcon } from '../icons'
import type { Messages } from '../i18n'

type ContactCellProps = {
  contact: ContactMethods
  t: Messages
}

function VerifiedBadge({ verified, t }: { verified: boolean; t: Messages }) {
  return (
    <span
      className={
        'verify-chip ' + (verified ? 'verify-chip--yes' : 'verify-chip--no')
      }
      title={verified ? t.verifiedYes : t.verifiedNo}
      aria-label={verified ? t.verifiedYes : t.verifiedNo}
    >
      {verified ? <CheckIcon width={10} height={10} /> : <XIcon width={10} height={10} />}
    </span>
  )
}

export function ContactCell({ contact, t }: ContactCellProps) {
  const email = primaryEmail(contact)
  const phone = primaryPhone(contact)
  const name = contact?.name ?? null
  const nothing = !name && !email && !phone
  if (nothing) {
    return <span className="muted">—</span>
  }
  return (
    <div className="contact-cell">
      {name ? (
        <div className="contact-line">
          <UserIcon width={12} height={12} className="contact-line-icon" />
          <span className="contact-line-text">{name}</span>
        </div>
      ) : (
        <div className="contact-line contact-line--muted">
          <UserIcon width={12} height={12} className="contact-line-icon" />
          <span className="contact-line-text">{t.unnamed}</span>
        </div>
      )}
      {email ? (
        <div className="contact-line">
          <MailIcon width={12} height={12} className="contact-line-icon" />
          <a className="contact-line-text contact-link" href={`mailto:${email}`}>
            {email}
          </a>
          <VerifiedBadge verified={isEmailVerified(contact)} t={t} />
        </div>
      ) : null}
      {phone ? (
        <div className="contact-line">
          <PhoneIcon width={12} height={12} className="contact-line-icon" />
          <a className="contact-line-text contact-link" href={`tel:${phone}`}>
            {phone}
          </a>
          <VerifiedBadge verified={isPhoneVerified(contact)} t={t} />
        </div>
      ) : null}
    </div>
  )
}
