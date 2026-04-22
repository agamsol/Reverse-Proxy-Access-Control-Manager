const en = {
  // Chrome
  appTitle: 'Network Access Manager',
  brand: 'Network Access Manager',
  themeToDark: 'Dark mode',
  themeToLight: 'Light mode',
  logout: 'Sign out',
  signedInAs: 'Signed in as',
  loading: 'Loading…',
  refresh: 'Refresh',
  projectName: 'Reverse-Proxy-Access-Control-Manager',
  apiVersion: 'Private-API',
  maintenanceSuffix: 'Maintenance',
  viewOnGitHub: 'Source on GitHub',
  connectionProblem: 'Connection problem',
  maintenanceBanner: 'This service is under maintenance. Some actions may be unavailable.',

  // Navigation
  navServices: 'Services',
  navPending: 'Pending Connections',
  navConnections: 'Allowed Connections',
  navIgnored: 'Ignored Connections',
  navWebhooks: 'Webhooks',
  navGroupConnections: 'Connections',
  navGroupConfiguration: 'Configuration',
  a11yMainNav: 'Main navigation',
  a11yOpenNavMenu: 'Open navigation menu',
  a11yCloseNavMenu: 'Close navigation menu',

  // Common buttons / statuses
  save: 'Save',
  saving: 'Saving…',
  create: 'Create',
  creating: 'Creating…',
  cancel: 'Cancel',
  close: 'Close',
  done: 'Done',
  edit: 'Edit',
  delete: 'Delete',
  deleting: 'Deleting…',
  confirm: 'Confirm',
  accept: 'Accept',
  deny: 'Deny',
  revoke: 'Revoke',
  retry: 'Retry',
  search: 'Search',
  searchClear: 'Clear search',
  noResults: 'No results',
  noMatch: 'Nothing matches your search.',
  optional: '(optional)',
  required: 'Required',
  requiredField: 'Required',
  yes: 'Yes',
  no: 'No',
  copy: 'Copy',
  copied: 'Copied',

  // Login page
  loginTitle: 'Administrator sign-in',
  loginLede:
    'Sign in with your administrator credentials to manage services, review requests, and configure webhooks.',
  usernameLabel: 'Username',
  passwordLabel: 'Password',
  rememberMeLabel: 'Keep me signed in for 60 days',
  rememberMeHint: 'Otherwise, your session ends after 24 hours.',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  errLoginFailed: 'Incorrect username or password.',
  errLoginGeneric: 'Could not sign in. Please try again.',
  sessionExpired: 'Your session has expired. Please sign in again.',

  // Services view
  servicesTitle: 'Services',
  servicesLede:
    'The catalog of services this proxy can route to. Requesters pick from this list when asking for access.',
  servicesEmpty: 'No services yet. Create one to get started.',
  servicesNewBtn: 'New service',
  servicesEditTitle: 'Edit service',
  servicesCreateTitle: 'Create service',
  servicesDeleteTitle: 'Delete service',
  servicesDeletePrompt:
    'Delete service “{name}”? Existing allowed and pending connections will not be affected, but new requests for this service will no longer be possible.',
  servicesNameLabel: 'Name',
  servicesNameHint: 'Up to 200 characters. Unique per deployment.',
  servicesDescriptionLabel: 'Description',
  servicesDescriptionHint: 'Short explanation shown to requesters. Optional.',
  servicesAddressLabel: 'Internal address',
  servicesAddressHint: 'IP address the proxy forwards to.',
  servicesPortLabel: 'Port',
  servicesProtocolLabel: 'Protocol',
  errServiceNameRequired: 'A service name is required.',
  errServicePort: 'Port must be between 1 and 65535.',
  errServiceExists: 'A service with that name already exists.',
  errServiceNotFound: 'That service no longer exists.',
  colName: 'Name',
  colDescription: 'Description',
  colDestination: 'Destination',
  colPort: 'Port',
  colProtocol: 'Protocol',
  colActions: 'Actions',

  // Pending view
  pendingTitle: 'Pending connections',
  pendingLede:
    'People asking for access to a protected service. Approve to grant access, or deny to remove the request (optionally blocking the IP).',
  pendingEmpty: 'No pending requests.',
  pendingAcceptConfirm: 'Accept this request and grant access?',
  pendingDenyTitle: 'Deny request',
  pendingDenyPrompt: 'Deny this request for “{name}”?',
  pendingDenyIgnoreLabel: 'Also block this IP from sending future requests',
  pendingDenyIgnoreHint:
    'The IP will be added to the ignore list. You can remove it later from the Ignored view.',
  colIp: 'IP address',
  colContact: 'Contact',
  colService: 'Service',
  colRequested: 'Requested',
  colExpiry: 'Access expires',
  colNotes: 'Notes',
  colLocation: 'Location',
  expiryMinutes: '{n} min',
  expiryHours: '{n} h',
  expiryDays: '{n} d',
  expiryNotSet: 'Not set',
  locationNotShared: 'Not shared',
  openInMaps: 'Open in maps',
  contactName: 'Name',
  contactEmail: 'Email',
  contactPhone: 'Phone',
  verifiedYes: 'Verified',
  verifiedNo: 'Not verified',
  unnamed: 'Anonymous',

  // Allowed connections view
  connectionsTitle: 'Allowed connections',
  connectionsLede:
    'Active grants. Revoking an entry immediately stops the proxy from forwarding the IP to the service.',
  connectionsEmpty: 'No active connections.',
  revokeConfirm: 'Revoke access for {ip} to “{service}”?',
  expiresIn: 'Expires {relative}',
  expiresNever: 'No expiration',
  expired: 'Expired',

  // Ignored view
  ignoredTitle: 'Ignored IPs',
  ignoredLede:
    'Addresses blocked from submitting new access requests. Remove an entry to let that IP request access again.',
  ignoredEmpty: 'No ignored addresses.',
  unignore: 'Un-ignore',
  unignoreConfirm: 'Allow {ip} to submit access requests for “{service}” again?',

  // Webhooks view
  webhooksTitle: 'Webhooks',
  webhooksLede:
    'Send an outbound HTTP request when an event occurs. Each event can have at most one webhook. Bodies support Jinja2 template variables from the event payload.',
  webhooksEmpty: 'No webhooks configured.',
  webhooksNewBtn: 'New webhook',
  webhooksCreateTitle: 'Create webhook',
  webhooksEditTitle: 'Edit webhook',
  webhooksDeleteTitle: 'Remove webhook',
  webhooksDeletePrompt: 'Remove the webhook for “{event}”?',
  webhookEventLabel: 'Event',
  webhookMethodLabel: 'HTTP method',
  webhookUrlLabel: 'URL',
  webhookHeadersLabel: 'Headers',
  webhookQueryLabel: 'Query parameters',
  webhookCookiesLabel: 'Cookies',
  webhookBodyLabel: 'Body (JSON)',
  webhookBodyHint:
    'Optional JSON object sent as the request body. Jinja2 templates like {{ ip }} are resolved by the server.',
  webhookKvAdd: 'Add row',
  webhookKvKey: 'Key',
  webhookKvValue: 'Value',
  webhookKvRemove: 'Remove row',
  webhookKvEmpty: 'No entries. Click “Add row” to add one.',
  webhookTest: 'Send test',
  webhookTesting: 'Sending…',
  webhookTestTitle: 'Test webhook',
  webhookTestIntro:
    'Fires a request from your browser to the configured URL so you can verify connectivity.',
  webhookTestNote:
    'Note — sent from the browser, so Jinja2 templates in the body are not rendered, the backend signature header is missing, and some headers (Cookie, Host, …) are blocked by the browser. CORS on the receiving server may also refuse the response.',
  webhookTestSuccess: 'Server responded: {status} {statusText}.',
  webhookTestOpaque:
    'Request was sent, but the response was opaque (likely blocked by CORS). The receiving service may still have received the call.',
  webhookTestNetworkError:
    'The request could not be completed. This usually means the URL is unreachable or CORS blocked the call.',
  webhookTestInvalidUrl: 'The URL is not valid.',
  errWebhookInvalidJson: 'Invalid JSON in {field}.',
  errWebhookEventTaken: 'A webhook already exists for this event. Edit it instead.',
  errWebhookEventMissing: 'No webhook is configured for this event.',
  errWebhookUrlRequired: 'A URL is required.',
  webhookTemplatesHeading: 'Need inspiration?',
  webhookTemplatesIntro:
    'Drop-in examples for Discord, SendGrid, Resend and SMS-over-HTTP are maintained on GitHub.',
  webhookTemplatesBrowse: 'Browse example templates',
  webhookTemplatesVariables: 'Template variables reference',
  eventPendingNew: 'New pending request',
  eventPendingAccepted: 'Request accepted',
  eventPendingDenied: 'Request denied',
  eventConnectionRevoked: 'Connection revoked',
  eventPendingNewDesc: 'Triggered when a new access request is received.',
  eventPendingAcceptedDesc: 'Triggered when an access request is approved.',
  eventPendingDeniedDesc: 'Triggered when an access request is denied.',
  eventConnectionRevokedDesc: 'Triggered when an existing connection is revoked.',

  // Shift-click shortcut
  shiftSkipConfirmHint: 'Hold Shift to skip confirmation',
  shiftSkipAccept: 'Accept (Shift-click to skip confirmation)',
  shiftSkipDeny: 'Deny (Shift-click to skip confirmation and not block the IP)',
  shiftSkipRevoke: 'Revoke (Shift-click to skip confirmation)',
  shiftSkipUnignore: 'Un-ignore (Shift-click to skip confirmation)',

  // Pagination
  pageSizeLabel: 'Rows per page',
  paginationShowing: 'Showing {from}–{to} of {total}',
  paginationTotal: '{total} total',
  paginationPage: 'Page {page} of {total}',
  paginationPrev: 'Previous',
  paginationNext: 'Next',

  // Errors
  errGeneric: 'Something went wrong. Please try again.',
  errLoadFailed: 'Could not load data from the server.',
} as const

// The admin dashboard is English-only; `Lang` is kept as a one-member union
// so downstream helpers (format.ts, etc.) don't need their signatures
// churned — and so Hebrew can be re-introduced later without refactoring.
export type Lang = 'en'
export type Messages = typeof en

export const strings: Record<Lang, Messages> = {
  en,
}
