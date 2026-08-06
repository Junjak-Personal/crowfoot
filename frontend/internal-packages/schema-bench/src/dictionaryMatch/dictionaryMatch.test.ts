import { describe, expect, it } from 'vitest'
import { dictionaryMatch } from './dictionaryMatch'

describe('dictionaryMatch (concept-based)', () => {
  it('matches domain synonyms via concept aliases (customer_info ↔ client_data)', () => {
    const reference = ['customer_info']
    const predict = ['client_data']
    const mapping: Record<string, string> = {}
    dictionaryMatch(reference, predict, mapping)
    expect(mapping).toEqual({ customer_info: 'client_data' })
  })

  it('matches industry expressions (order_details ↔ purchase_items)', () => {
    const reference = ['order_details']
    const predict = ['purchase_items']
    const mapping: Record<string, string> = {}
    dictionaryMatch(reference, predict, mapping)
    expect(mapping).toEqual({ order_details: 'purchase_items' })
  })

  it('matches abbreviation vs formal name (user_profiles ↔ account_info)', () => {
    const reference = ['user_profiles']
    const predict = ['account_info']
    const mapping: Record<string, string> = {}
    dictionaryMatch(reference, predict, mapping)
    expect(mapping).toEqual({ user_profiles: 'account_info' })
  })

  it('does not falsely match unrelated (client_log ↔ customer_info)', () => {
    const reference = ['customer_info']
    const predict = ['client_log']
    const mapping: Record<string, string> = {}
    dictionaryMatch(reference, predict, mapping)
    expect(mapping).toEqual({})
  })
})
