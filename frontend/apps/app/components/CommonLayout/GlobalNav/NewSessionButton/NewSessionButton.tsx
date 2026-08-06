import clsx from 'clsx'
import { MessageCircleIcon } from 'lucide-react'
import Link from 'next/link'
import type { FC } from 'react'
import { urlgen } from '../../../../libs/routes'
import itemStyles from '../Item.module.css'
import styles from './NewSessionButton.module.css'

export const NewSessionButton: FC = () => {
  return (
    <Link
      href={urlgen('design_sessions/new')}
      className={clsx(itemStyles.item, styles.newSessionButton)}
    >
      <div className={clsx(itemStyles.iconContainer, styles.iconContainer)}>
        <MessageCircleIcon className={styles.icon} />
      </div>
      <div className={clsx(itemStyles.labelArea, styles.labelArea)}>
        <span className={clsx(itemStyles.label)}>New Session</span>
      </div>
    </Link>
  )
}
