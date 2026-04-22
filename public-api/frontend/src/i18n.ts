import he from './i18n.he.json'

const en = {
  title: 'Guest network access',
  subtitleRedirect: 'Access control',
  subtitleWhy:
    'This service accepts only approved connections. Use this page to request access, and an administrator will review it for you.',
  langEn: 'English',
  langHe: 'Hebrew',
  themeToDark: 'Dark mode',
  themeToLight: 'Light mode',
  maintenanceBanner:
    'This access portal is under maintenance. Submissions may be delayed or unavailable.',
  connectionProblem: 'Connection problem',
  whatNext: 'What happens next',
  step1Title: 'Submit your request',
  step1Desc:
    'Select the services you need, add contact details, and optionally set when access should end, a note, or your location.',
  step2Title: 'Wait for administrator approval',
  step2Desc:
    'An administrator will review your request. The protected resource remains unavailable until access is granted.',
  step3Title: 'Continue to the service',
  step3Desc: 'Once approved, return to the original link from the same network.',
  requestAccess: 'Request access',
  services: 'Services',
  noServices: 'No services are currently available. Please contact an administrator.',
  servicesSearchClear: 'Clear search',
  servicesSearchPlaceholder: 'Search by name or description',
  servicesNoMatch: 'No services match your search.',
  categorySectionExpand: 'Expand',
  categorySectionCollapse: 'Collapse',
  accessUntilLabel: 'Access expiration',
  accessUntilAfterApproval: 'If approved, your access would expire {relative}.',
  nameLabel: 'Your name',
  emailLabel: 'Email',
  phoneLabel: 'Phone',
  phoneHint: 'Enter in international format, including the leading + and country code.',
  optionalSuffix: '(optional)',
  noteLabel: 'Context for reviewers',
  notePlaceholder: 'Optional message for the approval team — up to 200 characters',
  locationHeading: 'Location',
  locationExplain:
    'Your browser can share an approximate location if you allow it. You can choose whether to include it with this request.',
  shareLocation: 'Share my location',
  attachLocation: 'Attach location',
  detachLocation: 'Detach location',
  locationIdle: 'Location has not been captured yet.',
  locationRequesting: 'Requesting permission from your browser…',
  locationAcquired: 'Location captured (approximate).',
  locationDenied: 'Location was declined or is unavailable.',
  locationDeniedByUser:
    'Permission was denied. You can enable location for this site in your browser settings and try again.',
  locationUnavailable:
    'Your location could not be determined. Please try again or continue without it.',
  locationTimeout: 'The location request timed out. Please try again.',
  locationInsecureWarning:
    'Location sharing is only available on secure (HTTPS) connections. Continuing without location is fine.',
  includeLocation: 'Include my location with this request',
  submitRequest: 'Submit request',
  submitting: 'Sending…',
  errSelectService: 'Please select at least one service.',
  errDuration:
    'The access end time must be in the future. Clear the field or pick a later date and time.',
  errRequiredContact: 'Please fill in the required contact fields: {fields}.',
  errLocationInclude:
    'Allow location sharing, or turn off “Include my location with this request”.',
  errGeoUnsupported: 'Location services are not available in this browser.',
  apiVersion: 'Portal API',
  maintenanceSuffix: 'Maintenance',
  viewOnGitHub: 'Source on GitHub',
  howItWorks: 'How it works',
  close: 'Close',
  cancel: 'Cancel',
  done: 'Done',
  successTitle: 'Request submitted',
  ctaRequest: 'Request access',
  heroLede:
    'You reached a protected service that is not publicly accessible. Submit a short access request and an administrator will review it for your network.',
  contactSection: 'Contact details',
  detailsSection: 'Supplementary request details',
  reviewSend: 'Send request',
  destinationLabel: 'Destination',
  checkAccess: 'Check access',
  checkingAccess: 'Checking…',
  accessGranted: 'Access has been granted. You can continue to the service.',
  accessNotYet:
    'Access is not available yet. Please wait for an administrator to approve your request.',
  accessCheckError: 'The check could not complete. Please try again in a moment.',
  continueTo: 'Continue to destination',
  invalidRedirect: 'The destination URL is not valid and will be ignored.',
  responseCode: 'Response',
  responsePending: 'Sending…',
  responseNetwork: 'Network error',
  requiredField: 'Required',
} satisfies typeof he

export type Lang = 'en' | 'he'

export const strings = { en, he } as const

export type Messages = typeof he
