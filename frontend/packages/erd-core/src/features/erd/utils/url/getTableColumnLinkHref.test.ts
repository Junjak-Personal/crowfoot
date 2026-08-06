import { describe, expect, it } from 'vitest'
import { getTableColumnLinkHref } from './getTableColumnLinkHref'

it('should return the "active" query parameter and hash consistent with the table and column names', () => {
  window.location.search = ''
  window.location.hash = ''

  expect(getTableColumnLinkHref('users', 'created_at')).toBe(
    '?active=users#users__columns__created_at',
  )
})

describe('when other query parameters and hash are present', () => {
  it('should preserve existing query parameters and hash', () => {
    window.location.search = '?page=2&sort=asc'
    window.location.hash = '#other_hash'

    expect(getTableColumnLinkHref('users', 'created_at')).toBe(
      '?page=2&sort=asc&active=users#users__columns__created_at',
    )
  })
})
