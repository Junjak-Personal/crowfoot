// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { fromPromise } from '@liam-hq/neverthrow'
import {
  mysqlSchemaDeparser,
  postgresqlSchemaDeparser,
  yamlSchemaDeparser,
} from '@liam-hq/schema'
import {
  Button,
  ChevronDown,
  Copy,
  Download,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  useToast,
} from '@liam-hq/ui'
import type { FC } from 'react'
import {
  useSchemaOrThrow,
  useUserEditingOrThrow,
} from '../../../../../../stores'
import { dumpGroups, dumpMemos, dumpTableLayout } from '../../../../utils'

export const ExportDropdown: FC = () => {
  const toast = useToast()
  const schema = useSchemaOrThrow()
  const { editMode } = useUserEditingOrThrow()

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

  const copyMySQL = async () => {
    if (!navigator.clipboard || !navigator.clipboard?.writeText) {
      toast({ title: 'Clipboard unavailable', status: 'error' })
      return
    }

    const clipboardResult = await fromPromise(
      navigator.clipboard.writeText(buildMySQL()),
    )

    clipboardResult.match(
      () => {
        toast({
          title: 'MySQL DDL copied!',
          description: 'Schema DDL has been copied to clipboard',
          status: 'success',
        })
      },
      (error: Error) => {
        console.error('Failed to copy MySQL DDL to clipboard:', error)
        toast({
          title: 'Copy failed',
          description: `Failed to copy DDL to clipboard: ${error.message}`,
          status: 'error',
        })
      },
    )
  }

  const buildMySQL = () => {
    const result = mysqlSchemaDeparser(schema.current)
    return result.value ? `${result.value}\n` : ''
  }

  const download = (fileName: string, contents: string, mime: string) => {
    const blob = new Blob([contents], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()

    // The object URL would otherwise pin the blob for the life of the page.
    URL.revokeObjectURL(url)

    toast({ title: `${fileName} downloaded`, status: 'success' })
  }

  const downloadMySQL = () =>
    download('schema.mysql.sql', buildMySQL(), 'application/sql')

  /**
   * The layout and memo files are committed to the backend repo under
   * liam-custom-erd/, which is where the deploy picks them up. Downloading is
   * how an edit-mode session gets turned into something everyone can see.
   */
  const downloadLayout = () =>
    download(
      'layout.json',
      `${JSON.stringify(dumpTableLayout(), null, 2)}\n`,
      'application/json',
    )

  const downloadMemos = () =>
    download(
      'memos.json',
      `${JSON.stringify(dumpMemos(), null, 2)}\n`,
      'application/json',
    )

  const downloadGroups = () =>
    download(
      'groups.json',
      `${JSON.stringify(dumpGroups(), null, 2)}\n`,
      'application/json',
    )

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
          <DropdownMenuItem leftIcon={<Copy size={16} />} onSelect={copyMySQL}>
            Copy MySQL
          </DropdownMenuItem>
          <DropdownMenuItem
            leftIcon={<Download size={16} />}
            onSelect={downloadMySQL}
          >
            Download MySQL (.sql)
          </DropdownMenuItem>
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
          {editMode && (
            <>
              <DropdownMenuItem
                leftIcon={<Download size={16} />}
                onSelect={downloadLayout}
              >
                Download layout.json
              </DropdownMenuItem>
              <DropdownMenuItem
                leftIcon={<Download size={16} />}
                onSelect={downloadMemos}
              >
                Download memos.json
              </DropdownMenuItem>
              <DropdownMenuItem
                leftIcon={<Download size={16} />}
                onSelect={downloadGroups}
              >
                Download groups.json
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  )
}
