import { fromPromise } from '@liam-hq/neverthrow'
import { postgresqlSchemaDeparser, yamlSchemaDeparser } from '@liam-hq/schema'
import {
  Button,
  ChevronDown,
  Copy,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  useToast,
} from '@liam-hq/ui'
import type { FC } from 'react'
import { useSchemaOrThrow } from '../../../../../../stores'

export const ExportDropdown: FC = () => {
  const toast = useToast()
  const schema = useSchemaOrThrow()

  const handleCopyPostgreSQL = async () => {
    // Feature detection for clipboard API
    if (!navigator.clipboard || !navigator.clipboard?.writeText) {
      toast({
        title: 'Clipboard unavailable',
        status: 'error',
      })
      return
    }

    const result = postgresqlSchemaDeparser(schema.current)
    const ddl = result.value ? `${result.value}\n` : ''

    const clipboardResult = await fromPromise(
      navigator.clipboard.writeText(ddl),
    )

    clipboardResult.match(
      () => {
        toast({
          title: 'PostgreSQL DDL copied!',
          description: 'Schema DDL has been copied to clipboard',
          status: 'success',
        })
      },
      (error: Error) => {
        console.error('Failed to copy PostgreSQL DDL to clipboard:', error)
        toast({
          title: 'Copy failed',
          description: `Failed to copy DDL to clipboard: ${error.message}`,
          status: 'error',
        })
      },
    )
  }

  const handleCopyYaml = async () => {
    // Feature detection for clipboard API
    if (!navigator.clipboard || !navigator.clipboard?.writeText) {
      toast({
        title: 'Clipboard unavailable',
        status: 'error',
      })
      return
    }

    const yamlResult = yamlSchemaDeparser(schema.current)

    if (yamlResult.isErr()) {
      const error = yamlResult.error
      console.error('Failed to generate YAML:', error)
      toast({
        title: 'Export failed',
        description: `Failed to generate YAML: ${error.message}`,
        status: 'error',
      })
      return
    }

    const yamlContent = yamlResult.value
    const clipboardResult = await fromPromise(
      navigator.clipboard.writeText(yamlContent),
    )

    clipboardResult.match(
      () => {
        toast({
          title: 'YAML copied!',
          description: 'Schema YAML has been copied to clipboard',
          status: 'success',
        })
      },
      (error: Error) => {
        console.error('Failed to copy YAML to clipboard:', error)
        toast({
          title: 'Copy failed',
          description: `Failed to copy YAML to clipboard: ${error.message}`,
          status: 'error',
        })
      },
    )
  }

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline-secondary"
          size="md"
          rightIcon={<ChevronDown size={16} />}
        >
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuItem
            leftIcon={<Copy size={16} />}
            onSelect={handleCopyPostgreSQL}
          >
            Copy PostgreSQL
          </DropdownMenuItem>
          <DropdownMenuItem
            leftIcon={<Copy size={16} />}
            onSelect={handleCopyYaml}
          >
            Copy YAML
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  )
}
