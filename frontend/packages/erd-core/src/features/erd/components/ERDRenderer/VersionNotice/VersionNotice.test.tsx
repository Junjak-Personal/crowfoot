// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { aSchema, aTable } from '@crowfoot/schema'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { FC, PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaProvider, UserEditingProvider } from '../../../../../stores'
import { compressToEncodedUriComponent } from '../../../../../utils/compressToEncodedUriComponent'
import {
  type Group,
  getBaseVersion,
  registerBaseDocuments,
  serializeGroups,
  setBaseGroups,
  setBaseMemos,
} from '../../../utils'
import { VersionNotice } from './VersionNotice'

const schema = aSchema({ tables: { users: aTable({ name: 'users' }) } })

const billing: Group = {
  id: 'billing',
  name: 'Billing',
  tableNames: ['users'],
}

/** A link whose groups name a table the deployed schema no longer has. */
const groupsParam = (next: Group[]) =>
  compressToEncodedUriComponent(serializeGroups([billing], next))

const renderNotice = (searchParams: string) => {
  const wrapper: FC<PropsWithChildren> = ({ children }) => (
    <NuqsTestingAdapter searchParams={searchParams}>
      <UserEditingProvider>
        <SchemaProvider current={schema}>{children}</SchemaProvider>
      </UserEditingProvider>
    </NuqsTestingAdapter>
  )

  return render(<VersionNotice />, { wrapper })
}

beforeEach(() => {
  localStorage.clear()
  setBaseGroups([billing])
  setBaseMemos([])
  registerBaseDocuments({
    schema,
    layout: {},
    memos: [],
    groups: [billing],
  })
})

afterEach(() => {
  cleanup()
})

describe('VersionNotice', () => {
  it('says nothing when the link carries no edits', () => {
    renderNotice('?edit=1')

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('says nothing when the link was made against this very deploy', () => {
    renderNotice(`?base=${getBaseVersion()}`)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('speaks up when the link was made against a different one', () => {
    renderNotice('?base=deadbeef')

    expect(screen.getByRole('status')).toHaveTextContent(
      'This link was made against a different version',
    )
  })

  /**
   * The count is the part worth reading. "The version is different" on its own
   * gets dismissed without a thought.
   */
  it('names the tables the schema has lost that a group still refers to', () => {
    const next: Group[] = [
      { ...billing, tableNames: ['users', 'orders', 'payments'] },
    ]

    renderNotice(`?base=deadbeef&groups=${groupsParam(next)}`)

    expect(screen.getByRole('status')).toHaveTextContent(
      'no longer in the schema: orders, payments',
    )
  })

  it('says so plainly when nothing the edits refer to went missing', () => {
    renderNotice('?base=deadbeef')

    expect(screen.getByRole('status')).toHaveTextContent(
      'Nothing they refer to has gone missing',
    )
  })

  it('can be dismissed', async () => {
    renderNotice('?base=deadbeef')

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
