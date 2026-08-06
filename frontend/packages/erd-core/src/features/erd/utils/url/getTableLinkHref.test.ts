import { describe, expect, it } from 'vitest'
import { getTableLinkHref } from './getTableLinkHref'

it('should return the "active" query parameter with the table name', () => {
  window.location.search = ''

  expect(getTableLinkHref('users')).toBe('?active=users')
})

describe('when other query parameters are present', () => {
  it('should preserve existing query parameters', () => {
    window.location.search = '?page=2&sort=asc'

    expect(getTableLinkHref('users')).toBe('?page=2&sort=asc&active=users')
  })
})
