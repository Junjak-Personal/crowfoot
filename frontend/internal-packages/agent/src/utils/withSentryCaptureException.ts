import * as Sentry from '@sentry/node'

const ensureSentryInitialized = () => {
  const client = Sentry.getClient()
  if (!client || !client.getDsn()) {
    Sentry.init({
      dsn: process.env['SENTRY_DSN'] || '',
      tracesSampleRate: 1.0,
      environment: process.env['NEXT_PUBLIC_ENV_NAME'] || '',
      debug: false,
    })
  }
}

export const withSentryCaptureException = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  // eslint-disable-next-line no-restricted-syntax -- LangGraph requires throwing errors for proper retry mechanism
  try {
    return await operation()
  } catch (error) {
    ensureSentryInitialized()
    Sentry.captureException(error)
    throw error
  }
}
