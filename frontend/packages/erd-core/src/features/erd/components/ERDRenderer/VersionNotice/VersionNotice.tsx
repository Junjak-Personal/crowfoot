// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { type FC, useState } from 'react'
import { useSchemaOrThrow, useUserEditingOrThrow } from '../../../../../stores'
import {
  deserializeGroups,
  deserializeMemos,
  getBaseGroups,
  getBaseMemos,
  getBaseVersion,
  isStale,
  readCachedBase,
  staleReferences,
} from '../../../utils'
import styles from './VersionNotice.module.css'

const list = (names: string[]): string =>
  names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`

/**
 * How far the deployed documents moved, when this browser still has the ones
 * the link was written against. Absent for anyone else opening the link, which
 * is why nothing above depends on it.
 */
const upstreamChanges = (version: string): string | null => {
  const cached = readCachedBase(version)
  if (!cached) return null

  const before = JSON.stringify(cached.groups)
  const after = JSON.stringify(getBaseGroups())

  return before === after
    ? null
    : 'The groups it shipped with have changed too.'
}

/**
 * Says when a link's edits were written against a different deploy.
 *
 * A link carries only the difference from `schema.json` and the sidecars, so a
 * redeploy reaches everyone holding one — that is the point. The cost is that
 * the ground can move under an old link, and this is where that gets said out
 * loud instead of an edit silently applying to the wrong document, or silently
 * not applying at all.
 *
 * "The version is different" alone would be ignored, so it leads with what
 * could not be applied.
 */
export const VersionNotice: FC = () => {
  const [dismissed, setDismissed] = useState(false)
  const { baseVersionParam, groupEntries, memoEntries } =
    useUserEditingOrThrow()
  const { current: schema } = useSchemaOrThrow()

  const current = getBaseVersion()
  // No stamp means the link carries no edits, or predates the stamp; either
  // way there is nothing to be stale against.
  if (dismissed || baseVersionParam === '' || current === '') return null
  if (baseVersionParam === current) return null

  const stale = staleReferences({
    schema,
    baseGroups: getBaseGroups(),
    baseMemos: getBaseMemos(),
    groupDiff: deserializeGroups(groupEntries),
    memoDiff: deserializeMemos(memoEntries),
  })

  const upstream = upstreamChanges(baseVersionParam)

  return (
    <output className={styles.notice}>
      <div className={styles.body}>
        <strong>This link was made against a different version</strong> of the
        diagram. Your edits have been applied as they were.
        {stale.missingTables.length > 0 && (
          <>
            {' '}
            {stale.missingTables.length === 1 ? 'One table' : 'Tables'} named by
            your groups {stale.missingTables.length === 1 ? 'is' : 'are'} no
            longer in the schema: {list(stale.missingTables)}.
          </>
        )}
        {stale.emptyTombstones > 0 && (
          <>
            {' '}
            {stale.emptyTombstones} of the things this link deletes{' '}
            {stale.emptyTombstones === 1 ? 'was' : 'were'} already gone.
          </>
        )}
        {upstream !== null && <> {upstream}</>}
        {!isStale(stale) && upstream === null && (
          <> Nothing they refer to has gone missing.</>
        )}
      </div>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </button>
    </output>
  )
}
