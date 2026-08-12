// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { type Node, ReactFlow } from '@xyflow/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { FC, PropsWithChildren } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { VersionProvider } from '../../../../../../providers'
import type { Version } from '../../../../../../schemas/version'
import { UserEditingProvider } from '../../../../../../stores'
import type { TableGroupNodeType } from '../../../../types'
import { ErdContentProvider } from '../../ErdContentContext'
import { TableGroupNode } from './TableGroupNode'
import styles from './TableGroupNode.module.css'

/**
 * The header can commit table positions now (label drag), and that path logs a
 * reposition event, so the node needs a version in context.
 */
const version: Version = {
  version: '0.0.0',
  gitHash: 'abcdef0123',
  envName: 'test',
  date: '2026-08-05',
  displayedOn: 'web',
}

const nodeTypes = { tableGroup: TableGroupNode }

/** A stand-in member table — React Flow's own built-in `default` node type,
 * since only `id`/`position`/`measured` matter to bounding-box resolution. */
const aMemberNode = (
  id: string,
  x: number,
  measured?: { width: number; height: number },
): Node => ({
  id,
  type: 'default',
  position: { x, y: 0 },
  data: { label: id },
  selected: false,
  ...(measured ? { measured } : {}),
})

const aGroupNode = (
  dataOverride: Partial<TableGroupNodeType['data']> = {},
): TableGroupNodeType => ({
  id: 'tableGroup:g1',
  type: 'tableGroup',
  position: { x: 0, y: 0 },
  measured: { width: 0, height: 0 },
  draggable: false,
  selectable: false,
  data: {
    groupId: 'g1',
    name: 'Billing',
    tableNames: ['orders', 'payments'],
    color: undefined,
    ...dataOverride,
  },
})

const wrapperFor =
  (searchParams?: string): FC<PropsWithChildren> =>
  ({ children }) => (
    <NuqsTestingAdapter
      {...(searchParams === undefined ? {} : { searchParams })}
    >
      <VersionProvider version={version}>
        <UserEditingProvider>
          {/* Holds which group is selected — the state the header writes. */}
          <ErdContentProvider>{children}</ErdContentProvider>
        </UserEditingProvider>
      </VersionProvider>
    </NuqsTestingAdapter>
  )

/**
 * Uncontrolled (`defaultNodes`, not `nodes`): React Flow then owns selection
 * state internally, which `TableGroupNode`'s header click needs — its
 * imperative `useReactFlow().setNodes` call is queued and flushed against
 * React Flow's own store, and in controlled mode that queue has nowhere to
 * land without an external `onNodesChange` bridge.
 */
const renderCanvas = (defaultNodes: Node[], searchParams?: string) =>
  render(
    <ReactFlow
      defaultNodes={defaultNodes}
      defaultEdges={[]}
      nodeTypes={nodeTypes}
    />,
    {
      wrapper: wrapperFor(searchParams),
    },
  )

afterEach(() => {
  cleanup()
})

describe('TableGroupNode', () => {
  it('renders nothing before every member is measured (RISK-3)', () => {
    renderCanvas([
      aMemberNode('orders', 0), // unmeasured
      aMemberNode('payments', 200, { width: 100, height: 40 }),
      aGroupNode(),
    ])

    expect(screen.queryByText('Billing')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a dashed border box and the group label once every member is measured', () => {
    const { container } = renderCanvas([
      aMemberNode('orders', 0, { width: 100, height: 40 }),
      aMemberNode('payments', 200, { width: 100, height: 40 }),
      aGroupNode({ name: 'Billing' }),
    ])

    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(container.querySelector(`.${styles.box}`)).toBeInTheDocument()
  })

  it('renders nothing when the view toggle is off, even with measured members', () => {
    renderCanvas(
      [
        aMemberNode('orders', 0, { width: 100, height: 40 }),
        aMemberNode('payments', 200, { width: 100, height: 40 }),
        aGroupNode(),
      ],
      '?showgroups=off',
    )

    expect(screen.queryByText('Billing')).not.toBeInTheDocument()
  })

  it('only the header carries the pointer-interactive class — the box root does not (RISK-2)', () => {
    const { container } = renderCanvas([
      aMemberNode('orders', 0, { width: 100, height: 40 }),
      aMemberNode('payments', 200, { width: 100, height: 40 }),
      aGroupNode(),
    ])

    // `.box` declares `pointer-events: none` and `.header` declares
    // `pointer-events: auto` (TableGroupNode.module.css) — CSS a headless
    // DOM cannot compute, so this checks the class assignment a real
    // browser's pointer-events rule depends on, not the rendered hit-test
    // itself (that needs the browser-smoke checklist).
    const box = container.querySelector(`.${styles.box}`)
    expect(box).toBeInTheDocument()
    expect(box).not.toHaveClass(styles.header)

    const header = screen.getByRole('button')
    expect(header).toHaveClass(styles.header)
  })

  it.each([
    ['Billing', 'Select group Billing'],
    ['', 'Select unnamed group'],
  ])(
    'falls back the header aria-label correctly for name %j',
    (name, expectedLabel) => {
      renderCanvas([
        aMemberNode('orders', 0, { width: 100, height: 40 }),
        aMemberNode('payments', 200, { width: 100, height: 40 }),
        aGroupNode({ name }),
      ])

      expect(
        screen.getByRole('button', { name: expectedLabel }),
      ).toBeInTheDocument()
    },
  )

  /**
   * `fireEvent`, not `userEvent`: the button is clicked directly (a plain
   * React onClick, not React Flow's own pointer-gated node click), and
   * `userEvent`'s realistic hit-testing trips on React Flow's *own* unrelated
   * `pointer-events: none` inline style on this node's wrapper (driven by
   * `selectable`/`draggable`, both false for a group box) — that inline style
   * is React Flow's, not the CSS this test targets.
   */
  const aCanvasWithSelection = () =>
    renderCanvas([
      aMemberNode('orders', 0, { width: 100, height: 40 }),
      aMemberNode('payments', 200, { width: 100, height: 40 }),
      {
        ...aMemberNode('shipments', 400, { width: 100, height: 40 }),
        selected: true,
      },
      aGroupNode({ tableNames: ['orders', 'payments'] }),
    ])

  it('clicking the header selects the group itself, not the tables in it', () => {
    aCanvasWithSelection()

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    for (const table of ['orders', 'payments', 'shipments']) {
      expect(screen.getByTestId(`rf__node-${table}`)).not.toHaveClass(
        'selected',
      )
    }
  })

  it('double-clicking the header steps inside and selects the members', () => {
    aCanvasWithSelection()

    // `detail: 2` is the second click of a double-click. Not `dblClick`: the
    // canvas never delivers that event — d3-zoom stops it at the zoom pane to
    // run double-click-to-zoom — which is why the component counts clicks.
    fireEvent.click(screen.getByRole('button'), { detail: 2 })

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('rf__node-orders')).toHaveClass('selected')
    expect(screen.getByTestId('rf__node-payments')).toHaveClass('selected')
    expect(screen.getByTestId('rf__node-shipments')).not.toHaveClass('selected')
  })
})
