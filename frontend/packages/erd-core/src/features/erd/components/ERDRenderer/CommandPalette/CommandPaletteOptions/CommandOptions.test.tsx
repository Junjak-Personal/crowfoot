import { ToastProvider } from '@liam-hq/ui'
import { render, screen } from '@testing-library/react'
import { type Node, ReactFlowProvider } from '@xyflow/react'
import { Command } from 'cmdk'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { FC, PropsWithChildren } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { UserEditingProvider } from '../../../../../../stores'
import { CommandPaletteProvider } from '../CommandPaletteProvider'
import { CommandPaletteCommandOptions } from './CommandOptions'

const mockDefaultNodes = vi.fn<() => Node[]>()
const onUrlUpdate = vi.fn<() => [UrlUpdateEvent]>()

const wrapper: FC<PropsWithChildren> = ({ children }) => (
  <NuqsTestingAdapter onUrlUpdate={onUrlUpdate}>
    <UserEditingProvider>
      <ReactFlowProvider defaultNodes={mockDefaultNodes()}>
        <ToastProvider>
          <CommandPaletteProvider>
            <Command>{children}</Command>
          </CommandPaletteProvider>
        </ToastProvider>
      </ReactFlowProvider>
    </UserEditingProvider>
  </NuqsTestingAdapter>
)

it('renders options with descriptions', async () => {
  render(<CommandPaletteCommandOptions />, { wrapper })

  expect(
    screen.getByRole('option', { name: 'Copy Link ⌘ C' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('option', { name: 'Zoom to Fit ⇧ 1' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('option', { name: 'Tidy Up ⇧ T' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('option', { name: 'Show All Fields ⇧ 2' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('option', { name: 'Show Table Name ⇧ 3' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('option', { name: 'Show Key Only ⇧ 4' }),
  ).toBeInTheDocument()
})

describe('show/hide all tables options', () => {
  it('shows "Show All Tables " option and hide "Hide All Tables" option when all tables are hidden', () => {
    mockDefaultNodes.mockReturnValueOnce([
      {
        id: '1',
        type: 'table',
        data: {},
        position: { x: 0, y: 0 },
        hidden: true,
      },
      {
        id: '2',
        type: 'table',
        data: {},
        position: { x: 0, y: 0 },
        hidden: true,
      },
    ])

    render(<CommandPaletteCommandOptions />, { wrapper })

    expect(
      screen.getByRole('option', { name: 'Show All Tables ⇧ A' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'Hide All Tables ⇧ H' }),
    ).not.toBeInTheDocument()
  })

  it('shows "Hide All Tables" option and hide "Show All Tables" option when all tables are visible', () => {
    mockDefaultNodes.mockReturnValueOnce([
      {
        id: '1',
        type: 'table',
        data: {},
        position: { x: 0, y: 0 },
        hidden: false,
      },
      {
        id: '2',
        type: 'table',
        data: {},
        position: { x: 0, y: 0 },
        hidden: false,
      },
    ])

    render(<CommandPaletteCommandOptions />, { wrapper })

    expect(
      screen.queryByRole('option', { name: 'Show All Tables ⇧ A' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Hide All Tables ⇧ H' }),
    ).toBeInTheDocument()
  })

  it('shows both "Show All Tables" and "Hide All Tables" options when some tables are visible and the others are hidden', () => {
    mockDefaultNodes.mockReturnValueOnce([
      {
        id: '1',
        type: 'table',
        data: {},
        position: { x: 0, y: 0 },
        hidden: true,
      },
      {
        id: '2',
        type: 'table',
        data: {},
        position: { x: 0, y: 0 },
        hidden: false,
      },
    ])

    render(<CommandPaletteCommandOptions />, { wrapper })

    expect(
      screen.getByRole('option', { name: 'Show All Tables ⇧ A' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Hide All Tables ⇧ H' }),
    ).toBeInTheDocument()
  })
})
