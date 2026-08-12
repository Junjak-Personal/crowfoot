// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import {
  clearEditParams,
  dumpGroups,
  dumpMemos,
  dumpTableLayout,
  ERDRenderer,
  ErdRendererProvider,
  type Group,
  getCookie,
  getCookieJson,
  type Memo,
  parseGroups,
  parseMemos,
  parseTableLayout,
  registerBaseDocuments,
  setBaseGroups,
  setBaseMemos,
  setBaseTableLayout,
  VersionProvider,
  versionSchema,
} from '@crowfoot/erd-core'
import { type Schema, schemaSchema } from '@crowfoot/schema'
import { ResultAsync } from 'neverthrow'
import { useEffect, useState } from 'react'
import * as v from 'valibot'

declare global {
  interface Window {
    /** Console helpers for producing and resetting layout.json. */
    crowfootLayout?: {
      dump: () => Record<string, { x: number; y: number }>
      reset: () => void
    }
    /** Console helpers for producing and resetting memos.json. */
    crowfootMemos?: {
      dump: () => Memo[]
      reset: () => void
    }
    /** Console helpers for producing and resetting groups.json. */
    crowfootGroups?: {
      dump: () => Group[]
      reset: () => void
    }
  }
}

const emptySchema: Schema = {
  tables: {},
}

function loadSchemaContent() {
  return ResultAsync.fromPromise(
    fetch('./schema.json').then(async (response) => {
      if (!response.ok) {
        return await Promise.reject(
          new Error(`Failed to fetch schema: ${response.statusText}`),
        )
      }
      return await response.json()
    }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  ).map((data) => {
    const result = v.safeParse(schemaSchema, data)
    if (result.success) {
      return result.output
    }
    console.info(result.issues)
    return undefined
  })
}

/**
 * Sidecar files that customise the deployed ERD:
 *   layout.json  pinned table positions, so everyone sees the same arrangement
 *   memos.json   free-form notes pinned to the canvas
 *   groups.json  named, view-only sets of tables drawn as boxes on the canvas
 * All three are optional — without them tables fall back to the automatic
 * ELK layout, and no memos or groups are shown.
 */
function loadOptionalJson(fileName: string, fallback: unknown) {
  return ResultAsync.fromSafePromise(
    // 'no-cache' revalidates instead of trusting the browser copy; the CDN
    // still needs its own cache headers for these to update on deploy.
    fetch(`./${fileName}`, { cache: 'no-cache' })
      .then(async (response) =>
        response.ok ? await response.json() : fallback,
      )
      // Never let an optional file block the schema from loading.
      .catch(() => fallback),
  )
}

const versionData = {
  version: import.meta.env.VITE_CLI_VERSION_VERSION,
  gitHash: import.meta.env.VITE_CLI_VERSION_GIT_HASH,
  envName: import.meta.env.VITE_CLI_VERSION_ENV_NAME,
  isReleasedGitHash:
    import.meta.env.VITE_CLI_VERSION_IS_RELEASED_GIT_HASH === '1',
  date: import.meta.env.VITE_CLI_VERSION_DATE,
  displayedOn: 'cli',
}
const version = v.parse(versionSchema, versionData)

function getSidebarSettingsFromCookie(): {
  isOpen: boolean
  panelSizes: number[]
} {
  const sidebarState = getCookie('sidebar:state')
  const panelLayout = getCookieJson<number[]>('panels:layout')

  const isOpen = sidebarState === 'true'
  const panelSizes =
    Array.isArray(panelLayout) && panelLayout.length >= 2
      ? panelLayout
      : [20, 80]

  return {
    isOpen,
    panelSizes,
  }
}

function App() {
  /**
   * `null` until every sidecar and the schema are in. The canvas snapshots the
   * memos, the group boxes and the pinned positions **once, when it mounts** —
   * mounting it against an empty schema therefore fixes it with no memos and no
   * groups, and nothing later puts them back. It used to be remounted whenever
   * the schema changed, which hid this; a schema can be edited in place now, so
   * it is not.
   */
  const [schema, setSchema] = useState<Schema | null>(null)
  const { isOpen: defaultSidebarOpen, panelSizes } =
    getSidebarSettingsFromCookie()

  useEffect(() => {
    // Every sidecar has to be registered before the schema lands, otherwise
    // the first auto-layout pass runs without the pinned positions.
    /** Held so the four can be hashed together once the schema is in too. */
    let sidecars: [unknown, unknown, unknown] = [{}, [], []]

    ResultAsync.combine([
      loadOptionalJson('layout.json', {}),
      loadOptionalJson('memos.json', []),
      loadOptionalJson('groups.json', []),
    ])
      .map(([layout, memos, groups]) => {
        setBaseTableLayout(parseTableLayout(layout))
        setBaseMemos(parseMemos(memos))
        setBaseGroups(parseGroups(groups))
        sidecars = [layout, memos, groups]
        return null
      })
      .andThen(loadSchemaContent)
      .match(
        (val) => {
          const [layout, memos, groups] = sidecars
          // A link carries only the difference from these four, so it is only
          // meaningful next to them. Registering them is what lets the viewer
          // notice when a link was written against a different deploy.
          registerBaseDocuments({
            schema: val ?? emptySchema,
            layout,
            memos,
            groups,
          })
          setSchema(val ?? emptySchema)
        },
        (error) => {
          console.error('Error loading schema content:', error)
          setSchema(emptySchema)
        },
      )
  }, [])

  useEffect(() => {
    const publish = <T,>(value: T): T => {
      const json = JSON.stringify(value, null, 2)
      console.info(json)
      void navigator.clipboard?.writeText(json).catch(() => {
        // Clipboard is unavailable outside a secure context; the console
        // output above is still there to copy from.
      })
      return value
    }

    // `reset` drops the edit out of the link, which is where it lives now —
    // there is no browser-local working copy to clear any more.
    window.crowfootLayout = {
      dump: () => publish(dumpTableLayout()),
      reset: () => clearEditParams(['positions', 'colors']),
    }
    window.crowfootMemos = {
      dump: () => publish(dumpMemos()),
      reset: () => clearEditParams(['memos']),
    }
    window.crowfootGroups = {
      dump: () => publish(dumpGroups()),
      reset: () => clearEditParams(['groups']),
    }
  }, [])

  if (schema === null) return null

  return (
    <VersionProvider version={version}>
      <ErdRendererProvider schema={{ current: schema }}>
        <ERDRenderer
          withAppBar
          defaultSidebarOpen={defaultSidebarOpen}
          defaultPanelSizes={panelSizes}
        />
      </ErdRendererProvider>
    </VersionProvider>
  )
}

export default App
