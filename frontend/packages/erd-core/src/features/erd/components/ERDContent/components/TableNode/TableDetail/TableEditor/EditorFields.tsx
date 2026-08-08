// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { Plus, Trash2 } from '@crowfoot/ui'
import type { FC, ReactNode } from 'react'
import styles from './EditorFields.module.css'

type TextFieldProps = {
  label: string
  value: string
  placeholder?: string
  /** `false` rejects the edit, and the field snaps back to `value`. */
  onCommit: (value: string) => boolean
}

/**
 * Uncontrolled on purpose. Every commit rewrites `?schemaedits=`, which
 * remounts the canvas, so committing per keystroke would relayout the diagram
 * under the cursor mid-word — the edit lands when the field is left, or on
 * Enter. `key` is the value so an edit made elsewhere still refreshes the box.
 */
export const TextField: FC<TextFieldProps> = ({
  label,
  value,
  placeholder,
  onCommit,
}) => (
  <label className={styles.field}>
    <span className={styles.fieldLabel}>{label}</span>
    <input
      key={value}
      type="text"
      className={styles.text}
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(event) => {
        const next = event.target.value
        if (next === value) return
        if (!onCommit(next)) event.target.value = value
      }}
      onKeyDown={(event) => {
        // While an IME is composing, Enter confirms the candidate — it is not
        // "I am done with this field". Blurring on it cancels the composition,
        // which is how a Korean syllable comes back apart into jamo.
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  </label>
)

type CheckFieldProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export const CheckField: FC<CheckFieldProps> = ({
  label,
  checked,
  onChange,
}) => (
  <label className={styles.check}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span>{label}</span>
  </label>
)

type SelectFieldProps = {
  label: string
  value: string
  options: readonly string[]
  /** Shown first and selected when `value` is not one of `options`. */
  placeholder?: string
  onChange: (value: string) => void
}

export const SelectField: FC<SelectFieldProps> = ({
  label,
  value,
  options,
  placeholder,
  onChange,
}) => (
  <label className={styles.field}>
    <span className={styles.fieldLabel}>{label}</span>
    <select
      className={styles.select}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </label>
)

type ColumnListProps = {
  label: string
  /** Every column that may be picked, in table order. */
  available: readonly string[]
  /** The picked columns, in the order they apply. */
  value: string[]
  onChange: (value: string[]) => void
}

/**
 * An *ordered* list of single selects rather than one `<select multiple>`:
 * index order is meaningful for every list this edits — a composite primary
 * key, a unique constraint, a btree index — and a multiple select reports its
 * picks in document order, which would silently reorder them.
 */
export const ColumnList: FC<ColumnListProps> = ({
  label,
  available,
  value,
  onChange,
}) => (
  <div className={styles.field}>
    <span className={styles.fieldLabel}>{label}</span>
    <div className={styles.list}>
      {value.map((columnName, index) => (
        <div
          // Positional: the same column may legitimately appear twice while
          // the user is part-way through picking a composite key.
          // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity here
          key={index}
          className={styles.listRow}
        >
          <select
            className={styles.select}
            value={columnName}
            onChange={(event) =>
              onChange(
                value.map((v, i) => (i === index ? event.target.value : v)),
              )
            }
          >
            {/* A column that has since been renamed away still shows, so the
                constraint does not silently drop it on the next edit. */}
            {!available.includes(columnName) && (
              <option value={columnName}>{columnName}</option>
            )}
            {available.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <IconAction
            label={`Remove ${columnName}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <Trash2 size={13} />
          </IconAction>
        </div>
      ))}
      <AddButton
        label="Add column"
        disabled={available.length === 0}
        onClick={() => onChange([...value, available[0] ?? ''])}
      />
    </div>
  </div>
)

type IconActionProps = {
  label: string
  onClick: () => void
  children: ReactNode
}

export const IconAction: FC<IconActionProps> = ({
  label,
  onClick,
  children,
}) => (
  <button
    type="button"
    className={styles.iconAction}
    aria-label={label}
    title={label}
    onClick={onClick}
  >
    {children}
  </button>
)

type AddButtonProps = {
  label: string
  disabled?: boolean
  onClick: () => void
}

const AddButton: FC<AddButtonProps> = ({
  label,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    className={styles.addButton}
    disabled={disabled}
    onClick={onClick}
  >
    <Plus size={13} />
    {label}
  </button>
)
