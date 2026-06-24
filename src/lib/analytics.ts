// Privacy-respecting analytics.
//
// Visitor / page-view counts come ONLY from the Cloudflare Web Analytics beacon
// in index.html — cookieless, no personal data, no per-user tracking. There is
// deliberately no event pipeline here: nothing about the workbook a user opens
// is ever measured or transmitted. This shim exists so UI code has a single,
// obviously-inert place to "log" intent during development.

export function trackEvent(event: string, value?: string): void {
  if (import.meta.env.DEV) {
    // Dev-only console breadcrumb; never sent anywhere.
    // eslint-disable-next-line no-console
    console.debug('[event]', event, value ?? '');
  }
}
