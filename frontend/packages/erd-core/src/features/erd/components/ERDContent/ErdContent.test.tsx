// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { aSchema, aTable } from '@crowfoot/schema'
import { ToastProvider } from '@crowfoot/ui'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { type Node, ReactFlowProvider } from '@xyflow/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { FC, PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VersionProvider } from '../../../../providers'
import type { Version } from '../../../../schemas/version'
import { SchemaProvider, UserEditingProvider } from '../../../../stores'
import { decompressFromEncodedUriComponent } from '../../../../utils/decompressFromEncodedUriComponent'
import type { TableNodeData, TableNodeType } from '../../types'
import {
  deserializeGroups,
  type Group,
  getEffectiveGroups,
  setBaseGroups,
} from '../../utils'
import { ERDContent } from './ErdContent'

/**
 * The context-menu group actions (`Group selected tables`, `Remove from
 * group`, rename, ungroup, colour) live entirely inside ErdContent.tsx and
 * had zero coverage before this file. Assertions read the committed `?groups=`
 * back out of the URL and apply it to `groups.json` — which is what a reload
 * would do — rather than the rendered DOM, because the derived group box
 * depends on React Flow's async ResizeObserver-driven `measured` size, which
 * this test does not need.
 */

/** The last query string any commit wrote, captured from the nuqs adapter. */
let committed = new URLSearchParams()

/**
 * Exactly what a reload of the captured URL would put on the canvas.
 *
 * Use `settledGroups()` after an action: nuqs flushes URL writes on a timer,
 * so what a reload would see is not available synchronously — unlike the
 * localStorage mirror these assertions used to read.
 */
const committedGroups = (): Group[] =>
  getEffectiveGroups(
    deserializeGroups(
      decompressFromEncodedUriComponent(committed.get('groups') ?? '') ?? '',
    ),
  )

const settledGroups = async (): Promise<Group[]> => {
  await waitFor(() => {
    expect(committed.has('groups')).toBe(true)
  })
  return committedGroups()
}

const version: Version = {
  version: '0.0.0',
  gitHash: 'abcdef0123',
  envName: 'test',
  date: '2026-08-04',
  displayedOn: 'web',
}

const aTableNode = (name: string): TableNodeType => ({
  id: name,
  type: 'table',
  position: { x: 0, y: 0 },
  data: {
    table: aTable({ name }),
    isActiveHighlighted: false,
    isHighlighted: false,
    isTooltipVisible: false,
    sourceColumnName: undefined,
  } satisfies TableNodeData,
})

const schema = aSchema({
  tables: {
    orders: aTable({ name: 'orders' }),
    payments: aTable({ name: 'payments' }),
    shipments: aTable({ name: 'shipments' }),
  },
})

const wrapper: FC<PropsWithChildren> = ({ children }) => (
  <NuqsTestingAdapter
    searchParams="?edit=1"
    onUrlUpdate={(event) => {
      committed = event.searchParams
    }}
  >
    <ToastProvider>
      <ReactFlowProvider>
        <VersionProvider version={version}>
          <UserEditingProvider>
            <SchemaProvider current={schema}>{children}</SchemaProvider>
          </UserEditingProvider>
        </VersionProvider>
      </ReactFlowProvider>
    </ToastProvider>
  </NuqsTestingAdapter>
)

const nodes: Node[] = [
  aTableNode('orders'),
  aTableNode('payments'),
  aTableNode('shipments'),
]

/**
 * React Flow's own multi-select needs a real `Control` keydown on `window`
 * (the `multiSelectionActive` store flag lives there, not on the click
 * event). The click events themselves also need `ctrlKey: true`: ErdContent's
 * `handleNodeClickEvent` deliberately bails out of its single-table
 * `selectTable` navigation whenever the click is modified (ctrl/meta/shift),
 * exactly so that navigation does not stomp on a multi-selection in
 * progress — a plain click without that flag would run `selectTable`, which
 * overwrites the node list from a stale closure and wipes out the selection
 * this helper is trying to build.
 */
const multiSelect = (ids: string[]) => {
  fireEvent.keyDown(window, { key: 'Control', ctrlKey: true })
  for (const id of ids) {
    fireEvent.click(screen.getByTestId(`rf__node-${id}`), { ctrlKey: true })
  }
  fireEvent.keyUp(window, { key: 'Control' })
}

/** Ctrl+right-click, the editing menu's gesture (plain right-click pans). */
const rightClickCtrl = (testId: string) => {
  fireEvent.contextMenu(screen.getByTestId(testId), { ctrlKey: true })
}

const renderErdContent = () =>
  render(<ERDContent nodes={nodes} edges={[]} displayArea="main" />, {
    wrapper,
  })

beforeEach(() => {
  committed = new URLSearchParams()
  setBaseGroups([])
})

afterEach(() => {
  cleanup()
})

describe('ErdContent context-menu group actions', () => {
  it('"Group selected tables" is a pure append and does not strip existing membership', async () => {
    setBaseGroups([{ id: 'billing', name: 'Billing', tableNames: ['orders'] }])

    renderErdContent()

    multiSelect(['orders', 'payments'])
    rightClickCtrl('rf__node-orders')

    fireEvent.click(await screen.findByText('Group selected tables'))

    const groups = await settledGroups()
    expect(groups.find((g: Group) => g.id === 'billing')?.tableNames).toEqual([
      'orders',
    ])

    const created = groups.find((g: Group) => g.id !== 'billing')
    expect(created?.tableNames.slice().sort()).toEqual(['orders', 'payments'])
  })

  it('"Remove from" a group only touches that one membership, and drops an emptied group entirely', async () => {
    setBaseGroups([
      { id: 'billing', name: 'Billing', tableNames: ['orders'] },
      {
        id: 'shipping',
        name: 'Shipping',
        tableNames: ['orders', 'shipments'],
      },
    ])

    renderErdContent()

    rightClickCtrl('rf__node-orders')
    fireEvent.click(await screen.findByText('Remove from "Billing"'))

    const groups = await settledGroups()
    expect(groups.map((g: Group) => g.id)).toEqual(['shipping'])
    expect(groups.find((g: Group) => g.id === 'shipping')?.tableNames).toEqual([
      'orders',
      'shipments',
    ])
  })

  it('renaming a group applies to the right-clicked group only', async () => {
    setBaseGroups([
      { id: 'alpha', name: 'Alpha', tableNames: ['orders'] },
      { id: 'beta', name: 'Beta', tableNames: ['payments'] },
    ])

    renderErdContent()

    rightClickCtrl('rf__node-tableGroup:alpha')
    fireEvent.change(await screen.findByLabelText('Group name'), {
      target: { value: 'Renamed' },
    })

    const groups = await settledGroups()
    expect(groups.find((g: Group) => g.id === 'alpha')?.name).toBe('Renamed')
    expect(groups.find((g: Group) => g.id === 'beta')?.name).toBe('Beta')
  })

  it('ungrouping removes only the right-clicked group, once confirmed', async () => {
    setBaseGroups([
      { id: 'alpha', name: 'Alpha', tableNames: ['orders'] },
      { id: 'beta', name: 'Beta', tableNames: ['payments'] },
    ])

    renderErdContent()

    rightClickCtrl('rf__node-tableGroup:alpha')
    fireEvent.click(await screen.findByText('Ungroup'))
    fireEvent.click(await screen.findByRole('button', { name: 'Ungroup' }))

    const groups = await settledGroups()
    expect(groups.map((g: Group) => g.id)).toEqual(['beta'])
  })

  it('leaves the group alone when the confirmation is cancelled', async () => {
    setBaseGroups([
      { id: 'alpha', name: 'Alpha', tableNames: ['orders'] },
      { id: 'beta', name: 'Beta', tableNames: ['payments'] },
    ])

    renderErdContent()

    rightClickCtrl('rf__node-tableGroup:alpha')
    fireEvent.click(await screen.findByText('Ungroup'))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(committedGroups().map((g: Group) => g.id)).toEqual(['alpha', 'beta'])
  })

  it('applying a colour applies to the right-clicked group only', async () => {
    setBaseGroups([
      { id: 'alpha', name: 'Alpha', tableNames: ['orders'] },
      { id: 'beta', name: 'Beta', tableNames: ['payments'] },
    ])

    renderErdContent()

    rightClickCtrl('rf__node-tableGroup:alpha')
    fireEvent.click(await screen.findByRole('button', { name: 'gold' }))

    const groups = await settledGroups()
    expect(groups.find((g: Group) => g.id === 'alpha')?.color).toBe('gold')
    expect(groups.find((g: Group) => g.id === 'beta')?.color).toBeUndefined()
  })
})
