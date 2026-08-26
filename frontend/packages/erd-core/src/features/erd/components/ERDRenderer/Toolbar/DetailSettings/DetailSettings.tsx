// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import {
  Button,
  IconButton,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  SlidersHorizontal,
} from '@crowfoot/ui'
import { ToolbarButton } from '@radix-ui/react-toolbar'
import { type FC, useState } from 'react'
import { MAX_ZOOM, MIN_ZOOM } from '../../../../../reactflow/constants'
import { useLodSettings } from '../../../../hooks'
import { resetLodSettings, setLodSettings } from '../../../../utils'
import styles from './DetailSettings.module.css'

const asPercent = (zoom: number) => Math.round(zoom * 100)

type FieldProps = {
  label: string
  hint: string
  zoom: number
  onCommit: (zoom: number) => void
}

/**
 * Committed when the field is left, not per keystroke: clamping "5" on its way
 * to "50" would rewrite it to the minimum under the caret.
 */
const Field: FC<FieldProps> = ({ label, hint, zoom, onCommit }) => {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    const typed = Number(draft)
    setDraft(null)
    if (draft === null || draft === '' || !Number.isFinite(typed)) return
    onCommit(typed / 100)
  }

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        <span className={styles.hint}>{hint}</span>
      </span>
      <span className={styles.inputWrapper}>
        <input
          type="number"
          className={styles.input}
          min={asPercent(MIN_ZOOM)}
          max={asPercent(MAX_ZOOM)}
          value={draft ?? asPercent(zoom)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <span className={styles.unit}>%</span>
      </span>
    </label>
  )
}

/**
 * Where each rung of the detail ladder starts.
 *
 * How dense a diagram is, and how far away whoever is reading it sits, are
 * things only they know — 23 tables and 300 tables stop being legible at very
 * different zooms. Kept next to the zoom controls so the number in the toolbar
 * is the number being typed here.
 */
export const DetailSettings: FC = () => {
  const settings = useLodSettings()

  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        <ToolbarButton asChild>
          <IconButton
            icon={<SlidersHorizontal />}
            tooltipContent="Detail"
            size="md"
            aria-label="Detail"
            data-testid="toolbar-detail-settings"
          />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent side="top" sideOffset={4} className={styles.content}>
          <span className={styles.title}>Detail</span>

          <Field
            label="Names only"
            hint="tables drop their columns"
            zoom={settings.nameOnlyZoom}
            onCommit={(nameOnlyZoom) =>
              setLodSettings({ ...settings, nameOnlyZoom })
            }
          />
          <Field
            label="Groups only"
            hint="a group draws for its tables"
            zoom={settings.groupOnlyZoom}
            onCommit={(groupOnlyZoom) =>
              setLodSettings({ ...settings, groupOnlyZoom })
            }
          />

          <Button
            size="sm"
            variant="outline-secondary"
            onClick={resetLodSettings}
            className={styles.reset}
          >
            Reset
          </Button>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  )
}
