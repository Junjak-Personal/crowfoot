import {
  BaseGlobalNav,
  LayoutGrid,
  LiamDbLogo,
  LiamLogoMark,
  Settings,
} from '@liam-hq/ui'
import Link from 'next/link'
import type { FC } from 'react'
import type { Organization } from '../services/getOrganization'
import type { OrganizationsByUserId } from '../services/getOrganizationsByUserId'
import styles from './GlobalNav.module.css'
import itemStyles from './Item.module.css'
import { LinkItem } from './LinkItem'
import { NewSessionButton } from './NewSessionButton'
import { OrganizationItem } from './OrganizationItem'
import { RecentsSection } from './RecentsSection'

type Props = {
  currentOrganization: Organization | null
  organizations: OrganizationsByUserId | null
}

export const GlobalNav: FC<Props> = ({
  currentOrganization,
  organizations,
}) => {
  return (
    <BaseGlobalNav
      className={styles.globalNav}
      logoSection={
        <>
          <Link
            href="/design_sessions/new"
            className={itemStyles.iconContainer}
          >
            <LiamLogoMark />
          </Link>
          <Link href="/design_sessions/new" className={itemStyles.labelArea}>
            <LiamDbLogo className={styles.liamMigrationLogo} />
          </Link>
        </>
      }
      navContent={
        <>
          {currentOrganization && (
            <OrganizationItem
              currentOrganization={currentOrganization}
              organizations={organizations ?? []}
            />
          )}

          <LinkItem href="/projects" icon={<LayoutGrid />} label="Projects" />

          <NewSessionButton />
          <RecentsSection />
        </>
      }
      footerContent={
        <LinkItem
          href="/settings/general"
          icon={<Settings />}
          label="Settings"
        />
      }
    />
  )
}
