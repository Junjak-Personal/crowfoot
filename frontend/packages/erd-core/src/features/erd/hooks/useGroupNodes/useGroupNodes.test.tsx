// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { act, renderHook, waitFor } from '@testing-library/react'
import { type Node, ReactFlowProvider } from '@xyflow/react'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserEditingProvider } from '../../../../stores'
import { decompressFromEncodedUriComponent } from '../../../../utils/decompressFromEncodedUriComponent'
import {
  deserializeGroups,
  type Group,
  getEffectiveGroups,
  groupToNode,
  setBaseGroups,
} from '../../utils'
import { useGroupNodes } from './useGroupNodes'

const mockDefaultNodes = vi.fn<() => Node[]>()

/** The last query string a commit wrote. */
let committed = new URLSearchParams()

const wrapper = ({ children }: { children: ReactNode }) => (
  <NuqsTestingAdapter
    onUrlUpdate={(event: UrlUpdateEvent) => {
      committed = event.searchParams
    }}
  >
    <ReactFlowProvider defaultNodes={mockDefaultNodes()}>
      <UserEditingProvider>{children}</UserEditingProvider>
    </ReactFlowProvider>
  </NuqsTestingAdapter>
)

/** The raw `?groups=` payload, decompressed — the diff, not the whole set. */
const committedDiff = () =>
  decompressFromEncodedUriComponent(committed.get('groups') ?? '') ?? ''

/** What a reload of the captured URL would put on the canvas. */
const committedGroups = (): Group[] =>
  getEffectiveGroups(deserializeGroups(committedDiff()))

const payments: Group = {
  id: 'payment',
  name: 'Payments',
  tableNames: ['orders'],
}

const ordersNode: Node = {
  id: 'orders',
  type: 'table',
  data: {},
  position: { x: 0, y: 0 },
}

const settled = () =>
  waitFor(() => {
    expect(committed.has('groups')).toBe(true)
  })

describe('commitGroups', () => {
  beforeEach(() => {
    committed = new URLSearchParams()
    setBaseGroups([])
  })

  it('writes a group the build did not ship into the link', async () => {
    mockDefaultNodes.mockReturnValueOnce([ordersNode])

    const { result } = renderHook(() => useGroupNodes(), { wrapper })

    act(() => {
      result.current.commitGroups((nodes) => [...nodes, groupToNode(payments)])
    })

    await settled()
    expect(committedGroups()).toEqual([payments])
  })

  /**
   * The link has to be able to say "this one is gone", which is what it could
   * not do while it carried the whole set and simply replaced `groups.json`.
   */
  it('writes a tombstone when a group that shipped is removed', async () => {
    setBaseGroups([payments])
    const node = groupToNode(payments)
    mockDefaultNodes.mockReturnValueOnce([ordersNode, node])

    const { result } = renderHook(() => useGroupNodes(), { wrapper })

    act(() => {
      result.current.commitGroups((nodes) =>
        nodes.filter((current) => current.id !== node.id),
      )
    })

    await settled()
    expect(JSON.parse(committedDiff())).toEqual({
      changed: {},
      removed: ['payment'],
    })
    expect(committedGroups()).toEqual([])
  })

  /** The link must not accumulate entries for edits that were undone. */
  it('empties the link again once the canvas matches what shipped', async () => {
    setBaseGroups([payments])
    const node = groupToNode(payments)
    mockDefaultNodes.mockReturnValueOnce([ordersNode, node])

    const { result } = renderHook(() => useGroupNodes(), { wrapper })

    act(() => {
      result.current.commitGroups((nodes) =>
        nodes.filter((current) => current.id !== node.id),
      )
    })
    await settled()
    expect(committedDiff()).not.toBe('')

    act(() => {
      result.current.commitGroups((nodes) => [...nodes, node])
    })
    await waitFor(() => {
      expect(committedDiff()).toBe('')
    })
    expect(committedGroups()).toEqual([payments])
  })

  it('writes only group nodes, leaving table and memo nodes out of the link', async () => {
    mockDefaultNodes.mockReturnValueOnce([
      ordersNode,
      {
        id: 'note-1',
        type: 'memo',
        data: { text: 'hello' },
        position: { x: 0, y: 0 },
      },
    ])

    const { result } = renderHook(() => useGroupNodes(), { wrapper })

    act(() => {
      result.current.commitGroups((nodes) => [...nodes, groupToNode(payments)])
    })

    await settled()
    expect(committedGroups()).toEqual([payments])
  })
})
