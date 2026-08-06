import { GTM_CONSENT_MODE_KEY } from './constants'

export function updateConsent(consent: 'granted' | 'denied' | undefined) {
  const consentMode = {
    ad_storage: consent,
    analytics_storage: consent,
    personalization_storage: consent,
    functionality_storage: consent,
    security_storage: consent,
  }

  window.gtag('consent', 'update', consentMode)
  localStorage.setItem(GTM_CONSENT_MODE_KEY, JSON.stringify(consentMode))
}
