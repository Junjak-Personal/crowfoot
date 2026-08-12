// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { fromPromise } from '@crowfoot/neverthrow'
import {
  mysqlSchemaDeparser,
  postgresqlSchemaDeparser,
  yamlSchemaDeparser,
} from '@crowfoot/schema'
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
  ImageIcon,
  useToast,
} from '@crowfoot/ui'
import { useReactFlow, useStore } from '@xyflow/react'
import type { FC } from 'react'
import { useState } from 'react'
import {
  useSchemaOrThrow,
  useUserEditingOrThrow,
} from '../../../../../../stores'
import {
  captureDiagram,
  deserializeGroups,
  deserializeMemos,
  dumpTableLayout,
  findViewport,
  frameForBounds,
  frameForPane,
  getEffectiveGroups,
  getEffectiveMemos,
  isEmptyBounds,
  resolveCanvasBackground,
} from '../../../../utils'

type PngMode = 'diagram' | 'view' | 'selection'

const PNG_FILE_NAMES: Record<PngMode, string> = {
  diagram: 'erd.png',
  view: 'erd-view.png',
  selection: 'erd-selection.png',
}

export const ExportDropdown: FC = () => {
  const toast = useToast()
  const schema = useSchemaOrThrow()
  const { editMode, groupEntries, memoEntries } = useUserEditingOrThrow()
  /**
   * `getNodesBounds` from the hook, not the free function: tables with no
   * relationships are parented to the non-related group box, and React Flow
   * stores a child's position relative to its parent. Only the hook's version
   * knows the parents, so the free one measures those tables in the wrong
   * frame and the export is cropped.
   */
  const { getNodes, getNodesBounds, getViewport } = useReactFlow()
  /**
   * Subscribed rather than read from `getNodes()` at render time: that is an
   * imperative getter, so selecting a table would not re-render this menu and
   * the entry for it would go on being absent. Only the count is taken, so a
   * drag that changes nothing else re-renders nothing.
   */
  const selectedCount = useStore((state) => {
    let count = 0
    // `forEach` rather than `for…of`: the build targets ES2019, where iterating
    // a Map needs downlevelIteration.
    state.nodeLookup.forEach((node) => {
      if (node.selected && !node.hidden) count += 1
    })
    return count
  })
  /** Rasterising a large diagram takes a moment; two at once would fight. */
  const [isCapturing, setIsCapturing] = useState(false)

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
   * `null` when there is nothing to draw — an empty diagram, or a selection
   * that has since been cleared. Saying so beats writing out a blank image.
   *
   * The nodes are read here rather than during render so they are whatever is
   * on the canvas at the moment the menu item is chosen.
   */
  const resolveFrame = (mode: PngMode, viewport: HTMLElement) => {
    if (mode === 'view') {
      const pane = viewport.parentElement ?? viewport
      const { width, height } = pane.getBoundingClientRect()
      return width > 0 && height > 0
        ? frameForPane({ width, height }, getViewport())
        : null
    }

    const visible = getNodes().filter((node) => !node.hidden)
    const nodes =
      mode === 'selection' ? visible.filter((node) => node.selected) : visible
    if (nodes.length === 0) return null

    const bounds = getNodesBounds(nodes)
    return isEmptyBounds(bounds) ? null : frameForBounds(bounds)
  }

  const downloadPng = async (mode: PngMode) => {
    if (isCapturing) return

    const viewport = findViewport()
    const frame = viewport && resolveFrame(mode, viewport)
    if (!viewport || !frame) {
      toast({ title: 'Nothing to export', status: 'error' })
      return
    }

    setIsCapturing(true)
    const captured = await fromPromise(
      captureDiagram(viewport, frame, resolveCanvasBackground(viewport)),
    )
    setIsCapturing(false)

    captured.match(
      (dataUrl) => {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = PNG_FILE_NAMES[mode]
        link.click()

        toast({
          title: `${PNG_FILE_NAMES[mode]} downloaded`,
          status: 'success',
        })
      },
      (error: Error) => {
        console.error('Failed to export the diagram as PNG:', error)
        toast({
          title: 'Export failed',
          description: error.message,
          status: 'error',
        })
      },
    )
  }

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
      `${JSON.stringify(getEffectiveMemos(deserializeMemos(memoEntries)), null, 2)}\n`,
      'application/json',
    )

  const downloadGroups = () =>
    download(
      'groups.json',
      `${JSON.stringify(getEffectiveGroups(deserializeGroups(groupEntries)), null, 2)}\n`,
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
          {/* Not gated on edit mode: saving a picture reads the diagram, the
              same as the DDL above it. */}
          <DropdownMenuItem
            leftIcon={<ImageIcon size={16} />}
            onSelect={() => downloadPng('diagram')}
          >
            Download PNG — whole diagram
          </DropdownMenuItem>
          <DropdownMenuItem
            leftIcon={<ImageIcon size={16} />}
            onSelect={() => downloadPng('view')}
          >
            Download PNG — current view
          </DropdownMenuItem>
          {selectedCount > 0 && (
            <DropdownMenuItem
              leftIcon={<ImageIcon size={16} />}
              onSelect={() => downloadPng('selection')}
            >
              Download PNG — selection ({selectedCount})
            </DropdownMenuItem>
          )}
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
