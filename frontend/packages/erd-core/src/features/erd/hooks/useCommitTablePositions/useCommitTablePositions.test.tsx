// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { renderHook } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { act, type FC, type PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VersionProvider } from '../../../../providers'
import type { Version } from '../../../../schemas/version'
import { UserEditingProvider } from '../../../../stores'
import { compressToEncodedUriComponent } from '../../../../utils/compressToEncodedUriComponent'
import { decompressFromEncodedUriComponent } from '../../../../utils/decompressFromEncodedUriComponent'
import { setBaseTableLayout } from '../../utils'
import { useCommitTablePositions } from './useCommitTablePositions'

const version: Version = {
  version: '0.0.0',
  gitHash: 'abcdef0123',
  envName: 'test',
  date: '2026-08-05',
  displayedOn: 'web',
}

const aTableNode = (id: string, x: number, y: number): Node => ({
  id,
  type: 'table',
  position: { x, y },
  data: {},
})

const aMemoNode = (id: string): Node => ({
  id,
  type: 'memo',
  position: { x: 900, y: 900 },
  data: { text: '' },
})

const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()

/** `?positions=` is deflate+base64, so a search param has to be built, not typed. */
const positionsParam = (entries: string[]) =>
  `?positions=${encodeURIComponent(compressToEncodedUriComponent(entries.join(',')))}`

const wrapperFor =
  (searchParams?: string): FC<PropsWithChildren> =>
  ({ children }) => (
    <NuqsTestingAdapter
      {...(searchParams === undefined ? {} : { searchParams })}
      onUrlUpdate={onUrlUpdate}
    >
      <VersionProvider version={version}>
        <UserEditingProvider>{children}</UserEditingProvider>
      </VersionProvider>
    </NuqsTestingAdapter>
  )

/** The entries the last commit wrote, decompressed back to plain text. */
const writtenPositions = async (): Promise<string[]> => {
  await vi.waitFor(() => {
    expect(onUrlUpdate).toHaveBeenCalled()
  })

  // Reversed rather than `findLast`: the package's TS lib target predates it.
  const event = onUrlUpdate.mock.calls
    .map(([update]) => update)
    .reverse()
    .find((update) => update.queryString.includes('positions='))
  const encoded = event?.queryString.split('positions=')[1]?.split('&')[0]
  if (encoded === undefined) expect.fail('no positions were written')

  return decompressFromEncodedUriComponent(decodeURIComponent(encoded)).split(
    ',',
  )
}

beforeEach(() => {
  setBaseTableLayout({})
  onUrlUpdate.mockClear()
})

describe('useCommitTablePositions', () => {
  it('writes the moved tables', async () => {
    const { result } = renderHook(() => useCommitTablePositions(), {
      wrapper: wrapperFor(),
    })

    act(() => {
      result.current([aTableNode('orders', 10, 20)])
    })

    expect(await writtenPositions()).toContain('orders:10:20')
  })

  /**
   * The rule this hook exists to hold in one place: a link that arrives
   * carrying positions must not lose the tables this drag did not touch.
   */
  it('keeps positions the incoming link carried for tables this drag did not move', async () => {
    const { result } = renderHook(() => useCommitTablePositions(), {
      wrapper: wrapperFor(positionsParam(['payments:700:800'])),
    })

    act(() => {
      result.current([aTableNode('orders', 10, 20)])
    })

    const written = await writtenPositions()
    expect(written).toContain('payments:700:800')
    expect(written).toContain('orders:10:20')
  })

  it('lets the moved position win over the same table in the incoming link', async () => {
    const { result } = renderHook(() => useCommitTablePositions(), {
      wrapper: wrapperFor(positionsParam(['orders:700:800'])),
    })

    act(() => {
      result.current([aTableNode('orders', 10, 20)])
    })

    const written = await writtenPositions()
    expect(written).toContain('orders:10:20')
    expect(written).not.toContain('orders:700:800')
  })

  // A group-label drag hands over whatever it moved, and a mixed selection
  // carries memos alongside tables; only tables belong in the layout.
  it('writes nothing when the moved nodes hold no tables', async () => {
    const { result } = renderHook(() => useCommitTablePositions(), {
      wrapper: wrapperFor(),
    })

    act(() => {
      result.current([aMemoNode('note-1')])
    })

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(onUrlUpdate).not.toHaveBeenCalled()
  })
})
