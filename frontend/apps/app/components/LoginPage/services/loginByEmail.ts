'use server'
import { redirect } from 'next/navigation'
import * as v from 'valibot'

import { createClient } from '../../../libs/db/server'
import { urlgen } from '../../../libs/routes/urlgen'
import { ensureUserHasOrganization } from './ensureUserHasOrganization'
import { sanitizeReturnPath } from './validateReturnPath'

function maskEmail(email: string | undefined): string {
  if (!email || typeof email !== 'string') return '[invalid-email]'

  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return '[invalid-email]'

  const localPart = email.substring(0, atIndex)
  const domain = email.substring(atIndex)

  if (localPart.length <= 2) {
    return `${localPart[0]}*${domain}`
  }

  return `${localPart[0]}${'*'.repeat(localPart.length - 2)}${localPart[localPart.length - 1]}${domain}`
}

export async function loginByEmail(formData: FormData) {
  const supabase = await createClient()

  // Get the returnTo path from the form data and sanitize it
  // This will be set by the login page which reads from the cookie
  const formReturnTo = formData.get('returnTo')
  const returnTo = sanitizeReturnPath(
    formReturnTo?.toString(),
    '/design_sessions/new',
  )

  const loginFormSchema = v.object({
    email: v.pipe(v.string(), v.email('Please enter a valid email address')),
    password: v.string(),
  })

  // Parse and validate form data
  const formDataObject = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsedData = v.safeParse(loginFormSchema, formDataObject)
  if (!parsedData.success) {
    console.error('Login validation failed:', {
      errors: parsedData.issues,
      emailMasked: maskEmail(formDataObject.email?.toString()),
      timestamp: new Date().toISOString(),
    })
    redirect(urlgen('error'))
  }

  const data = parsedData.output

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.error('Login authentication failed:', {
      error: error.message,
      code: error.status,
      emailMasked: maskEmail(data.email),
      timestamp: new Date().toISOString(),
    })
    redirect(urlgen('error'))
  }

  await ensureUserHasOrganization()

  redirect(returnTo)
}
