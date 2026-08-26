// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { FC } from 'react'
import { useSchemaOrThrow } from '../../../../../../stores'
import styles from './SchemaSource.module.css'

/** Enough of a digest to tell two inputs apart at a glance. */
const SHA_LENGTH = 12

/**
 * Beyond this the list stops being readable in a menu. `jq .meta` on
 * `schema.json` is the complete answer; this is the one on screen.
 */
const LISTED = 3

const basename = (path: string) => path.split('/').pop() ?? path

/**
 * Where this diagram came from — the stamp `erd build` writes into
 * `schema.json`.
 *
 * A diagram is only worth trusting next to the input it was drawn from, and a
 * correct drawing of the *wrong* schema looks exactly like a correct one. This
 * puts the answer in the same screenshot as the diagram.
 *
 * Absent for a `schema.json` written before the stamp existed, and for one
 * assembled by something other than `erd build`; nothing is shown then rather
 * than a blank claiming to be a source.
 */
export const SchemaSource: FC = () => {
  const { current } = useSchemaOrThrow()
  const meta = current.meta

  if (meta === undefined) return null

  const listed = meta.sources.slice(0, LISTED)
  const remaining = meta.sources.length - listed.length

  return (
    <div className={styles.source}>
      {listed.map((source) => (
        <div key={source.path} className={styles.row} title={source.path}>
          <span className={styles.path}>{basename(source.path)}</span>
          <span className={styles.sha}>
            {source.sha256.slice(0, SHA_LENGTH)}
          </span>
        </div>
      ))}
      {remaining > 0 && (
        <div className={styles.row}>
          <span className={styles.path}>{`+${remaining} more`}</span>
        </div>
      )}
      <div className={styles.row}>
        <span className={styles.path}>
          {`built ${meta.builtAt.slice(0, 10)}`}
        </span>
      </div>
    </div>
  )
}
