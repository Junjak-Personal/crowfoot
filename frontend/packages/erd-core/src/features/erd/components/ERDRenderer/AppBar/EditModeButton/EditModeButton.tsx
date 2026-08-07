// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { Button, Pencil } from '@crowfoot/ui'
import type { FC } from 'react'
import { useUserEditingOrThrow } from '../../../../../../stores'

/**
 * Toggles `?edit=1`. The parameter has always been the source of truth — this
 * only stops it from being something you have to know to type.
 */
export const EditModeButton: FC = () => {
  const { editMode, setEditMode } = useUserEditingOrThrow()

  const handleClick = () => {
    setEditMode(!editMode)
  }

  return (
    <Button
      variant={editMode ? 'solid-primary' : 'outline-secondary'}
      size="md"
      leftIcon={<Pencil size={16} />}
      aria-pressed={editMode}
      onClick={handleClick}
    >
      {editMode ? 'Editing' : 'Edit'}
    </Button>
  )
}
