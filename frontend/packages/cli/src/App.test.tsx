// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react'
import type { FC, PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The order these land in is the whole point of the test.
 *
 * The canvas reads the memos, the group boxes and the pinned positions once,
 * when it mounts, so every `setBase*` has to have run by then. 0.2.0 rendered
 * the diagram immediately and registered the sidecars when their fetches came
 * back, which drew a diagram with neither — and the sidebar went on listing the
 * groups, so it did not look like a loading problem.
 */
const calls: string[] = []

vi.mock('@crowfoot/erd-core', async () => {
  const v = await import('valibot')
  const record = (name: string) => () => {
    calls.push(name)
  }

  const ERDRenderer: FC = () => {
    calls.push('render')
    return <div data-testid="erd" />
  }

  return {
    ERDRenderer,
    ErdRendererProvider: ({ children }: PropsWithChildren) => children,
    VersionProvider: ({ children }: PropsWithChildren) => children,
    versionSchema: v.any(),
    setBaseTableLayout: record('setBaseTableLayout'),
    setBaseMemos: record('setBaseMemos'),
    setBaseGroups: record('setBaseGroups'),
    parseTableLayout: (value: unknown) => value,
    parseMemos: (value: unknown) => value,
    parseGroups: (value: unknown) => value,
    clearStoredTableLayout: () => {},
    clearStoredMemos: () => {},
    clearStoredGroups: () => {},
    dumpTableLayout: () => ({}),
    dumpMemos: () => [],
    dumpGroups: () => [],
    getCookie: () => undefined,
    getCookieJson: () => undefined,
  }
})

/** Resolves each file only when the test says so, so the gap is observable. */
const pending = new Map<string, (body: unknown) => void>()

const serve = (file: string, body: unknown) => {
  const settle = pending.get(file)
  if (!settle) throw new Error(`nothing fetched ${file}`)
  settle(body)
}

beforeEach(() => {
  calls.length = 0
  pending.clear()

  vi.stubGlobal(
    'fetch',
    (url: string) =>
      new Promise((resolve) => {
        pending.set(url.replace('./', ''), (body) =>
          resolve({ ok: true, json: () => Promise.resolve(body) }),
        )
      }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('registers every sidecar before it draws the diagram', async () => {
    const { default: App } = await import('./App.js')
    render(<App />)

    await waitFor(() => expect(pending.size).toBe(3))
    expect(screen.queryByTestId('erd')).toBeNull()

    serve('layout.json', {})
    serve('memos.json', [])
    serve('groups.json', [])

    await waitFor(() => expect(pending.has('schema.json')).toBe(true))
    serve('schema.json', { tables: {}, enums: {}, extensions: {} })

    await waitFor(() => expect(screen.queryByTestId('erd')).not.toBeNull())

    expect(calls.indexOf('render')).toBeGreaterThan(
      Math.max(
        calls.indexOf('setBaseTableLayout'),
        calls.indexOf('setBaseMemos'),
        calls.indexOf('setBaseGroups'),
      ),
    )
  })

  it('draws nothing at all while the sidecars are still in flight', async () => {
    const { default: App } = await import('./App.js')
    render(<App />)

    await waitFor(() => expect(pending.size).toBe(3))

    expect(calls).not.toContain('render')
  })
})
