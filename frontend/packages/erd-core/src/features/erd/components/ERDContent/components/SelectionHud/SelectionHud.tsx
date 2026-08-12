// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { type FC, useState } from 'react'
import type { Group } from '../../../../utils'
import styles from './SelectionHud.module.css'

type Props = {
  /** Tables React Flow has selected. Empty when a group is selected instead. */
  selectedTableNames: string[]
  /** The group selected as an object, if that is what the selection is. */
  selectedGroup: Group | undefined
  /** The panel is an editing surface; outside edit mode there is nothing on it. */
  editMode: boolean
  /** Every group on the canvas, for the two menus. */
  groups: Group[]
  onGroup: () => void
  onAddToGroup: (groupId: string) => void
  onRemoveFromGroup: (groupId: string) => void
  onEnterGroup: (group: Group) => void
  onUngroup: () => void
  /**
   * The membership a row would produce, while the pointer is on it, or null on
   * the way out. The canvas draws it instead of the real one.
   */
  onPreview: (preview: { groupId: string; tableNames: string[] } | null) => void
}

const label = (group: Group) => group.name || 'Unnamed group'

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`

type MenuProps = {
  title: string
  groups: Group[]
  onPick: (groupId: string) => void
  onPreviewRow: (group: Group) => void
  onPreviewEnd: () => void
}

const GroupMenu: FC<MenuProps> = ({
  title,
  groups,
  onPick,
  onPreviewRow,
  onPreviewEnd,
}) => {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.menuAnchor} onMouseLeave={onPreviewEnd}>
      <button
        type="button"
        className={styles.action}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {title} ▾
      </button>
      {open && (
        <div className={styles.menu}>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={styles.menuItem}
              onMouseEnter={() => onPreviewRow(group)}
              onFocus={() => onPreviewRow(group)}
              onClick={() => {
                onPick(group.id)
                onPreviewEnd()
                setOpen(false)
              }}
            >
              {label(group)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * What is selected, and what can be done to it.
 *
 * The two questions belong in one place: before this, the count existed only
 * as a condition on a context-menu item, so "did the lasso catch four tables
 * or five" could only be answered by counting outlines. Every button here is
 * derived from the selection and is absent — not disabled — when it does not
 * apply, because a greyed-out button cannot say why.
 */
export const SelectionHud: FC<Props> = ({
  selectedTableNames,
  selectedGroup,
  editMode,
  groups,
  onGroup,
  onAddToGroup,
  onRemoveFromGroup,
  onEnterGroup,
  onUngroup,
  onPreview,
}) => {
  if (!editMode) return null

  if (selectedGroup) {
    return (
      <output className={styles.hud}>
        <span className={styles.summary}>
          Group “{label(selectedGroup)}” ·{' '}
          {plural(selectedGroup.tableNames.length, 'table')}
        </span>
        <button
          type="button"
          className={styles.action}
          onClick={() => onEnterGroup(selectedGroup)}
        >
          Select its tables
        </button>
        <button type="button" className={styles.action} onClick={onUngroup}>
          Ungroup
        </button>
      </output>
    )
  }

  if (selectedTableNames.length === 0) return null

  const selected = new Set(selectedTableNames)
  const claiming = groups.filter((group) =>
    group.tableNames.some((name) => selected.has(name)),
  )
  const joinable = groups.filter((group) =>
    selectedTableNames.some((name) => !group.tableNames.includes(name)),
  )

  return (
    <output className={styles.hud}>
      <span className={styles.summary}>
        {plural(selectedTableNames.length, 'table')} selected
        {claiming.length > 0 && ` · in ${plural(claiming.length, 'group')}`}
      </span>
      {selectedTableNames.length >= 2 && (
        <button type="button" className={styles.action} onClick={onGroup}>
          Group
        </button>
      )}
      {joinable.length > 0 && (
        <GroupMenu
          title="Add to"
          groups={joinable}
          onPick={onAddToGroup}
          onPreviewRow={(group) =>
            onPreview({
              groupId: group.id,
              tableNames: group.tableNames.concat(
                selectedTableNames.filter(
                  (name) => !group.tableNames.includes(name),
                ),
              ),
            })
          }
          onPreviewEnd={() => onPreview(null)}
        />
      )}
      {claiming.length > 0 && (
        <GroupMenu
          title="Remove from"
          groups={claiming}
          onPick={onRemoveFromGroup}
          onPreviewRow={(group) =>
            onPreview({
              groupId: group.id,
              tableNames: group.tableNames.filter(
                (name) => !selected.has(name),
              ),
            })
          }
          onPreviewEnd={() => onPreview(null)}
        />
      )}
    </output>
  )
}
