'use client'

import { Button, Input, useToast } from '@liam-hq/ui'
import { useActionState, useEffect, useId, useState } from 'react'
import { FormatSelectDropdown } from '../../../../features/sessions/components/shared/FormatSelectDropdown/FormatSelectDropdown'
import type { FormatType } from '../../../FormatIcon/FormatIcon'
import { saveSchemaFilePath } from '../../actions/saveSchemaFilePath'
import styles from './SchemaFilePathForm.module.css'

type Props = {
  projectId: string
  existingPath?: string | null
  existingFormat?: FormatType | null | undefined
}

export const SchemaFilePathForm = ({
  projectId,
  existingPath,
  existingFormat,
}: Props) => {
  const formId = useId()
  const toast = useToast()
  const [formatValue, setFormatValue] = useState<FormatType>(
    existingFormat || 'postgres',
  )

  const [state, action] = useActionState(saveSchemaFilePath, {
    success: false,
    error: null,
    message: null,
  })

  useEffect(() => {
    if (state.success && state.message) {
      toast({
        title: 'Saved',
        description: state.message,
        status: 'success',
      })
    } else if (state.error) {
      toast({
        title: 'Error',
        description: state.error,
        status: 'error',
      })
    }
  }, [state, toast])

  return (
    <div className={styles.card}>
      <div className={styles.rowContainer}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Schema File Path</h3>
        </div>
        <div className={styles.inputContainer}>
          <label htmlFor={`${formId}-path`} className={styles.label}>
            Path
          </label>
          <Input
            id={`${formId}-path`}
            name="path"
            form={formId}
            defaultValue={existingPath || undefined}
            placeholder="e.g., schema.sql or path/to/schema.rb"
            className={styles.input}
          />
          <label htmlFor={`${formId}-format`} className={styles.label}>
            Format
          </label>
          <FormatSelectDropdown
            selectedFormat={formatValue}
            onFormatChange={setFormatValue}
          />
          <p className={styles.helperText}>
            Configure the path to your schema file in the repository.
          </p>
        </div>
      </div>
      <div className={styles.divider} />
      <div className={styles.cardFooter}>
        <form id={formId} action={action}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="format" value={formatValue} />
          <Button variant="solid-primary" type="submit">
            Save
          </Button>
        </form>
      </div>
    </div>
  )
}
