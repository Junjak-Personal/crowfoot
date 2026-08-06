import { LiamLogoMark } from '@liam-hq/ui'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '../../libs/db/server'
import { EmailForm } from './EmailForm'
import styles from './LoginPage.module.css'
import { LogoutToast } from './LogoutToast'
import { SignInGithubButton } from './SignInGithubButton'

export async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  let returnTo = '/design_sessions/new'

  const cookieStore = await cookies()
  const returnToCookie = cookieStore.get('returnTo')
  if (returnToCookie) {
    returnTo = returnToCookie.value
  }

  if (user && !error) {
    redirect(returnTo)
  }

  return (
    <div className={styles.container}>
      <LogoutToast />
      <div className={styles.cardContainer}>
        <div className={styles.card}>
          <div className={styles.titleWrapper}>
            <LiamLogoMark className={styles.logoMark} />
            <h1 className={styles.title}>Sign in to Liam DB</h1>
          </div>

          <div className={styles.oauthList}>
            <EmailForm returnTo={returnTo} />
            <div className={styles.divider}>
              <span>OR</span>
            </div>
            <SignInGithubButton returnTo={returnTo} />
          </div>
        </div>
      </div>
    </div>
  )
}
