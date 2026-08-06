'use server'

import { cookies } from 'next/headers'
import { ORGANIZATION_ID_KEY } from '../constants'

export async function setOrganizationIdCookie(
  organizationId: string,
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ORGANIZATION_ID_KEY, organizationId)
}
