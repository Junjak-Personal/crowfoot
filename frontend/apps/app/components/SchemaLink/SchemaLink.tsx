import { ArrowUpRight } from '@liam-hq/ui'
import type { FC } from 'react'
import { FormatIcon, type FormatType } from '../FormatIcon'
import styles from './SchemaLink.module.css'

type SchemaLinkProps = {
  schemaName: string
  format?: FormatType
  href: string
}

export const SchemaLink: FC<SchemaLinkProps> = ({
  schemaName,
  format = 'postgres',
  href,
}) => {
  return (
    <a
      href={href}
      className={styles.schemaLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open schema ${schemaName} in a new tab`}
    >
      <div className={styles.formatIcon}>
        <FormatIcon format={format} />
      </div>
      <span className={styles.schemaName}>{schemaName}</span>
      <div className={styles.iconContainer}>
        <ArrowUpRight size={12} />
      </div>
    </a>
  )
}
