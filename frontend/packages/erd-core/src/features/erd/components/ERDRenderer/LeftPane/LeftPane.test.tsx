// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { aTable } from '@crowfoot/schema'
import { SidebarProvider } from '@crowfoot/ui'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type Node, ReactFlowProvider } from '@xyflow/react'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { FC, PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VersionProvider } from '../../../../../providers'
import type { Version } from '../../../../../schemas/version'
import { UserEditingProvider } from '../../../../../stores'
import { compressToEncodedUriComponent } from '../../../../../utils/compressToEncodedUriComponent'
import type { TableNodeData, TableNodeType } from '../../../types'
import {
  clearStoredGroups,
  groupToNode,
  saveStoredGroups,
  setBaseGroups,
} from '../../../utils'
import { LeftPane } from './LeftPane'
import styles from './LeftPane.module.css'

const version: Version = {
  version: '0.0.0',
  gitHash: 'abcdef0123',
  envName: 'test',
  date: '2026-08-04',
  displayedOn: 'web',
}

const aTableNode = (
  name: string,
  override: Partial<TableNodeType> = {},
): TableNodeType => ({
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
  ...override,
})

const aMemoNode = (id: string): Node => ({
  id,
  type: 'memo',
  position: { x: 0, y: 0 },
  data: { text: '' },
})

const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()

const wrapperFor =
  (nodes: Node[], searchParams?: string): FC<PropsWithChildren> =>
  ({ children }) => (
    <NuqsTestingAdapter
      {...(searchParams === undefined ? {} : { searchParams })}
      onUrlUpdate={onUrlUpdate}
    >
      <ReactFlowProvider defaultNodes={nodes}>
        <VersionProvider version={version}>
          <UserEditingProvider>
            <SidebarProvider open>{children}</SidebarProvider>
          </UserEditingProvider>
        </VersionProvider>
      </ReactFlowProvider>
    </NuqsTestingAdapter>
  )

const renderLeftPane = (nodes: Node[], searchParams?: string) =>
  render(<LeftPane />, { wrapper: wrapperFor(nodes, searchParams) })

/**
 * Section labels and their table rows are DOM siblings (each group section
 * is a React Fragment, not a wrapping element), so scoping with `within()`
 * is not possible. This walks the sectioned `<ul>` in render order and
 * regroups it by the label rows, which is what the render actually promises
 * — a table id following a label belongs to that section, until the next
 * label.
 */
const sectionsFromDom = (container: HTMLElement) => {
  const menu = container.querySelector(`ul.${styles.tablesMenu}`)
  if (!menu) expect.fail('sectioned menu not found')

  const sections: { label: string; tableIds: string[] }[] = []
  for (const li of Array.from(menu.children)) {
    const tableButton = li.querySelector(
      '[data-testid^="table-name-menu-button-"]',
    )
    if (tableButton) {
      const id = tableButton
        .getAttribute('data-testid')
        ?.replace('table-name-menu-button-', '')
      const current = sections.at(-1)
      if (current && id) current.tableIds.push(id)
    } else {
      sections.push({ label: li.textContent ?? '', tableIds: [] })
    }
  }
  return sections
}

beforeEach(() => {
  clearStoredGroups()
  setBaseGroups([])
  onUrlUpdate.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('LeftPane group sectioning', () => {
  it('renders one section per group plus Ungrouped, and a table in two groups renders under both labels', () => {
    saveStoredGroups([
      { id: 'billing', name: 'Billing', tableNames: ['orders'] },
      {
        id: 'shipping',
        name: 'Shipping',
        tableNames: ['orders', 'shipments'],
      },
    ])

    const { container } = renderLeftPane([
      aTableNode('orders'),
      aTableNode('payments'),
      aTableNode('shipments'),
    ])

    expect(sectionsFromDom(container)).toEqual([
      { label: 'Billing', tableIds: ['orders'] },
      { label: 'Shipping', tableIds: ['orders', 'shipments'] },
      { label: 'Ungrouped', tableIds: ['payments'] },
    ])

    // The query constraint from the plan: a duplicated table produces a
    // duplicate testid, so `getByTestId` would throw — `getAllByTestId` is
    // required here.
    expect(screen.getAllByTestId('table-name-menu-button-orders')).toHaveLength(
      2,
    )
  })

  it('counts a duplicated table once in the (n/m visible) header, never once per section row', () => {
    saveStoredGroups([
      { id: 'billing', name: 'Billing', tableNames: ['orders'] },
      {
        id: 'shipping',
        name: 'Shipping',
        tableNames: ['orders', 'shipments'],
      },
    ])

    renderLeftPane([
      aTableNode('orders'),
      aTableNode('payments'),
      aTableNode('shipments'),
    ])

    // 3 distinct tables, all visible — not 4/3, which is what counting the
    // duplicated "orders" row twice would produce.
    expect(screen.getByText('(3/3 visible)')).toBeInTheDocument()
  })

  it('single view (showgroups=off) is a flat alphabetical list with every table exactly once and no section labels', () => {
    saveStoredGroups([
      { id: 'billing', name: 'Billing', tableNames: ['orders'] },
      {
        id: 'shipping',
        name: 'Shipping',
        tableNames: ['orders', 'shipments'],
      },
    ])

    renderLeftPane(
      [aTableNode('orders'), aTableNode('payments'), aTableNode('shipments')],
      '?showgroups=off',
    )

    expect(screen.getAllByTestId(/^table-name-menu-button-/)).toHaveLength(3)
    expect(screen.queryByText('Billing')).not.toBeInTheDocument()
    expect(screen.queryByText('Shipping')).not.toBeInTheDocument()
    expect(screen.queryByText('Ungrouped')).not.toBeInTheDocument()
  })

  it('renders a byte-identical list in both modes when there is no group data to show', () => {
    const nodes = [
      aTableNode('orders'),
      aTableNode('payments'),
      aTableNode('shipments'),
    ]

    const noGroupsAtAll = () => {
      clearStoredGroups()
      const { container, unmount } = renderLeftPane(nodes)
      const html = container.querySelector(`ul.${styles.tablesMenu}`)?.outerHTML
      unmount()
      return html
    }

    const allMembersDropped = () => {
      // References a table that does not exist in `nodes` — every member is
      // dropped at render time, so this group contributes no section either
      // (§5.5 / UI/UX ruling 10).
      saveStoredGroups([{ id: 'ghost', name: 'Ghost', tableNames: ['none'] }])
      const { container, unmount } = renderLeftPane(nodes)
      const html = container.querySelector(`ul.${styles.tablesMenu}`)?.outerHTML
      unmount()
      return html
    }

    const singleViewBaseline = () => {
      clearStoredGroups()
      const { container, unmount } = renderLeftPane(nodes, '?showgroups=off')
      const html = container.querySelector(`ul.${styles.tablesMenu}`)?.outerHTML
      unmount()
      return html
    }

    const baseline = singleViewBaseline()
    expect(baseline).toBeTruthy()
    expect(noGroupsAtAll()).toBe(baseline)
    expect(allMembersDropped()).toBe(baseline)
    expect(baseline).not.toContain('Ungrouped')
  })

  it('gives "Ungrouped" no colour dot, while a named-but-uncoloured group still gets one', () => {
    saveStoredGroups([
      { id: 'billing', name: 'Billing', tableNames: ['orders'] },
    ])

    renderLeftPane([aTableNode('orders'), aTableNode('payments')])

    const billingLabel = screen.getByText('Billing').closest('li')
    const ungroupedLabel = screen.getByText('Ungrouped').closest('li')

    expect(
      billingLabel?.querySelector('[aria-hidden="true"]'),
    ).toBeInTheDocument()
    expect(
      ungroupedLabel?.querySelector('[aria-hidden="true"]'),
    ).not.toBeInTheDocument()
  })
})

describe('LeftPane regressions', () => {
  /**
   * Every other test here seeds groups through `saveStoredGroups`, which is a
   * synchronous localStorage read and is therefore already in place on the
   * first render. `groups.json` is not: the host app fetches it and calls
   * `setBaseGroups` when that resolves, which is after LeftPane has mounted.
   * Memoising on `groupEntries` alone pinned the empty pre-fetch value, so a
   * deployed ERD whose only group source was groups.json showed boxes on the
   * canvas (rebuilt by the `schemaKey` remount) and a flat sidebar forever.
   */
  it('sections the list when groups.json lands after the first render', () => {
    const { container } = renderLeftPane([
      aTableNode('orders'),
      aTableNode('payments'),
    ])

    expect(sectionsFromDom(container)).toEqual([])

    act(() => {
      setBaseGroups([
        { id: 'billing', name: 'Billing', tableNames: ['orders'] },
      ])
    })

    expect(sectionsFromDom(container)).toEqual([
      { label: 'Billing', tableIds: ['orders'] },
      { label: 'Ungrouped', tableIds: ['payments'] },
    ])
  })

  // F4: unfiltered, this pushed memo and group node ids into `?hidden=` too.
  it('"Show Only Selected Layers" hides only unselected TABLE ids — memo and group ids never join `?hidden=`', async () => {
    const user = userEvent.setup()

    renderLeftPane([
      aTableNode('orders'),
      aTableNode('payments'),
      aMemoNode('note-1'),
      groupToNode({ id: 'g1', name: 'Billing', tableNames: ['orders'] }),
    ])

    // Select "orders" only.
    await user.click(screen.getByTestId('table-name-menu-button-orders'))

    // Radix's `ContextMenu.Trigger` attaches its own listener to a span
    // *inside* the row div, so the event has to originate there (or on a
    // descendant of it) to bubble into that listener — firing it on the row
    // div itself is an ancestor of the trigger, which bubbling never reaches.
    const ordersRow = screen.getByTestId('table-name-menu-button-orders')
    await user.pointer({
      keys: '[MouseRight]',
      target: within(ordersRow).getByText('orders'),
    })
    await user.click(await screen.findByText('Show Only Selected Layers'))

    await vi.waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled()
    })

    const hiddenCall = onUrlUpdate.mock.calls
      .map(([event]) => event)
      .find((event) => event.queryString.includes('hidden='))
    expect(hiddenCall).toBeDefined()
    // The compressed `?hidden=` value decodes to exactly the one other table
    // id ("payments") — never "note-1" or the group node id. Decoding
    // (rather than substring-matching the compressed bytes) is required:
    // the querystring is deflate+base64, not plaintext.
    const encoded = hiddenCall?.queryString.split('hidden=')[1]?.split('&')[0]
    expect(encoded).toBe(compressToEncodedUriComponent('payments'))
  })
})
