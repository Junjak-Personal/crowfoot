// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Group } from '../../../../utils'
import { SelectionHud } from './SelectionHud'

const core: Group = {
  id: 'core',
  name: 'Core',
  tableNames: ['users', 'posts'],
  color: undefined,
}
const billing: Group = {
  id: 'billing',
  name: 'Billing',
  tableNames: ['orders'],
  color: undefined,
}

const renderHud = (props: Partial<Parameters<typeof SelectionHud>[0]> = {}) => {
  const handlers = {
    onGroup: vi.fn(),
    onMoveToGroup: vi.fn(),
    onRemoveFromGroups: vi.fn(),
    onEnterGroup: vi.fn(),
    onUngroup: vi.fn(),
    onPreview: vi.fn(),
  }

  render(
    <SelectionHud
      editMode
      selectedTableNames={[]}
      selectedGroup={undefined}
      groups={[]}
      {...handlers}
      {...props}
    />,
  )

  return handlers
}

afterEach(() => {
  cleanup()
})

describe('SelectionHud', () => {
  it('is not on screen while nothing is selected', () => {
    renderHud()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('is not on screen outside edit mode, whatever is selected', () => {
    renderHud({ editMode: false, selectedTableNames: ['users', 'posts'] })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('says how many tables are selected', () => {
    renderHud({ selectedTableNames: ['users', 'posts', 'comments'] })

    expect(screen.getByRole('status')).toHaveTextContent('3 tables selected')
  })

  /** A table is in one group, so there is nothing to enumerate. */
  it('does not also name the groups they are in', () => {
    renderHud({ selectedTableNames: ['users'], groups: [core, billing] })

    expect(screen.getByRole('status')).not.toHaveTextContent('Core')
  })

  it('counts one table without pluralising it', () => {
    renderHud({ selectedTableNames: ['users'] })

    expect(screen.getByRole('status')).toHaveTextContent('1 table selected')
  })

  /**
   * Absent, not disabled: a greyed-out button cannot say why it is greyed out,
   * and every one of these has a condition worth reading off the panel.
   */
  it('offers no grouping until two tables are selected', () => {
    renderHud({ selectedTableNames: ['users'] })

    expect(
      screen.queryByRole('button', { name: 'Group' }),
    ).not.toBeInTheDocument()
  })

  it('offers grouping once two are', async () => {
    const { onGroup } = renderHud({ selectedTableNames: ['users', 'posts'] })

    await userEvent.click(screen.getByRole('button', { name: 'Group' }))

    expect(onGroup).toHaveBeenCalled()
  })

  it('offers no group to move to when there are none', () => {
    renderHud({ selectedTableNames: ['users'] })

    expect(screen.queryByRole('button', { name: /Move to/ })).toBeNull()
  })

  it('offers no group to move to when every one already has the selection', () => {
    renderHud({ selectedTableNames: ['users', 'posts'], groups: [core] })

    expect(screen.queryByRole('button', { name: /Move to/ })).toBeNull()
  })

  it('moves the selection into a group picked from the menu', async () => {
    const { onMoveToGroup } = renderHud({
      selectedTableNames: ['comments'],
      groups: [core, billing],
    })

    await userEvent.click(screen.getByRole('button', { name: /Move to/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Billing' }))

    expect(onMoveToGroup).toHaveBeenCalledWith('billing')
  })

  /**
   * One button, no menu: a table is in one group, so there is never a choice
   * of which membership to give up.
   */
  it('offers removal only when the selection is in a group at all', async () => {
    const { onRemoveFromGroups } = renderHud({
      selectedTableNames: ['users'],
      groups: [core, billing],
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove from group' }),
    )

    expect(onRemoveFromGroups).toHaveBeenCalled()
  })

  it('offers no removal when the selection is in no group', () => {
    renderHud({ selectedTableNames: ['comments'], groups: [core, billing] })

    expect(
      screen.queryByRole('button', { name: 'Remove from group' }),
    ).toBeNull()
  })

  /**
   * A move is two changes at once. Previewing only the group that grows would
   * draw a moment in which the table is in both — the state this release
   * exists to make impossible.
   */
  it('previews the group being left shrinking as the one joined grows', async () => {
    const { onPreview } = renderHud({
      selectedTableNames: ['orders'],
      groups: [core, billing],
    })

    await userEvent.click(screen.getByRole('button', { name: /Move to/ }))
    await userEvent.hover(screen.getByRole('button', { name: 'Core' }))

    expect(onPreview).toHaveBeenCalledWith({
      core: ['users', 'posts', 'orders'],
      billing: [],
    })
  })

  it('previews leaving as the membership that would be left behind', async () => {
    const { onPreview } = renderHud({
      selectedTableNames: ['posts'],
      groups: [core],
    })

    await userEvent.hover(
      screen.getByRole('button', { name: 'Remove from group' }),
    )

    expect(onPreview).toHaveBeenCalledWith({ core: ['users'] })
  })

  describe('with a group selected', () => {
    it('names the group and how much is in it', () => {
      renderHud({ selectedGroup: core })

      expect(screen.getByRole('status')).toHaveTextContent(
        'Group “Core” · 2 tables',
      )
    })

    it('calls an unnamed group something rather than nothing', () => {
      renderHud({ selectedGroup: { ...core, name: '' } })

      expect(screen.getByRole('status')).toHaveTextContent('Unnamed group')
    })

    it('steps down to the tables in it', async () => {
      const { onEnterGroup } = renderHud({ selectedGroup: core })

      await userEvent.click(
        screen.getByRole('button', { name: 'Select its tables' }),
      )

      expect(onEnterGroup).toHaveBeenCalledWith(core)
    })

    it('ungroups it', async () => {
      const { onUngroup } = renderHud({ selectedGroup: core })

      await userEvent.click(screen.getByRole('button', { name: 'Ungroup' }))

      expect(onUngroup).toHaveBeenCalled()
    })

    /** The table commands would have nothing to act on. */
    it('offers none of the table commands', () => {
      renderHud({ selectedGroup: core, groups: [core, billing] })

      expect(screen.queryByRole('button', { name: 'Group' })).toBeNull()
      expect(screen.queryByRole('button', { name: /Move to/ })).toBeNull()
    })
  })
})
