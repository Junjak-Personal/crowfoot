// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { act, renderHook, waitFor } from '@testing-library/react'
import { type Node, ReactFlowProvider } from '@xyflow/react'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserEditingProvider } from '../../../../stores'
import { compressToEncodedUriComponent } from '../../../../utils/compressToEncodedUriComponent'
import { clearStoredGroups, groupToNode, loadStoredGroups } from '../../utils'
import { useGroupNodes } from './useGroupNodes'

const mockDefaultNodes = vi.fn<() => Node[]>()
const onUrlUpdate = vi.fn<() => [UrlUpdateEvent]>()

const wrapper = ({ children }: { children: ReactNode }) => (
  <NuqsTestingAdapter onUrlUpdate={onUrlUpdate}>
    <ReactFlowProvider defaultNodes={mockDefaultNodes()}>
      <UserEditingProvider>{children}</UserEditingProvider>
    </ReactFlowProvider>
  </NuqsTestingAdapter>
)

describe('commitGroups', () => {
  beforeEach(() => {
    clearStoredGroups()
  })

  it('mirrors an added group to storage and the link', async () => {
    mockDefaultNodes.mockReturnValueOnce([
      { id: 'orders', type: 'table', data: {}, position: { x: 0, y: 0 } },
    ])

    const { result } = renderHook(() => useGroupNodes(), { wrapper })

    const added = groupToNode({
      id: 'payment',
      name: 'Payments',
      tableNames: ['orders'],
    })

    act(() => {
      result.current.commitGroups((nodes) => [...nodes, added])
    })

    expect(loadStoredGroups()).toEqual([
      { id: 'payment', name: 'Payments', tableNames: ['orders'] },
    ])

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: expect.stringContaining('groups='),
        }),
      )
    })
  })

  it('mirrors a removed group by leaving storage and the link empty', async () => {
    const group = groupToNode({
      id: 'payment',
      name: 'Payments',
      tableNames: ['orders'],
    })
    mockDefaultNodes.mockReturnValueOnce([
      { id: 'orders', type: 'table', data: {}, position: { x: 0, y: 0 } },
      group,
    ])

    const { result } = renderHook(() => useGroupNodes(), { wrapper })

    act(() => {
      result.current.commitGroups((nodes) =>
        nodes.filter((node) => node.id !== group.id),
      )
    })

    expect(loadStoredGroups()).toEqual([])

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryString: `?groups=${compressToEncodedUriComponent('[]')}`,
        }),
      )
    })
  })

  it('only mirrors group nodes, leaving table and memo nodes out of storage', async () => {
    mockDefaultNodes.mockReturnValueOnce([
      { id: 'orders', type: 'table', data: {}, position: { x: 0, y: 0 } },
      {
        id: 'note-1',
        type: 'memo',
        data: { text: 'hello' },
        position: { x: 0, y: 0 },
      },
    ])

    const { result } = renderHook(() => useGroupNodes(), { wrapper })

    const added = groupToNode({
      id: 'payment',
      name: 'Payments',
      tableNames: ['orders'],
    })

    act(() => {
      result.current.commitGroups((nodes) => [...nodes, added])
    })

    expect(loadStoredGroups()).toEqual([
      { id: 'payment', name: 'Payments', tableNames: ['orders'] },
    ])
  })
})
