import { describe, it, expect } from 'vitest'
import { extractMentionHandles, newMentionHandles } from '../mentions'

describe('extractMentionHandles', () => {
  it('finds simple handles', () => {
    expect(extractMentionHandles('hey @sarah check this')).toEqual(['sarah'])
  })

  it('lowercases and de-duplicates', () => {
    expect(extractMentionHandles('@Sarah and @sarah and @SARAH')).toEqual(['sarah'])
  })

  it('supports dots, hyphens, underscores', () => {
    expect(extractMentionHandles('@a.b @c-d @e_f')).toEqual(['a.b', 'c-d', 'e_f'])
  })

  it('ignores single-character handles (min 2)', () => {
    expect(extractMentionHandles('@a is too short')).toEqual([])
  })

  it('caps handle length at 32 chars', () => {
    const long = 'x'.repeat(40)
    const [handle] = extractMentionHandles(`@${long}`)
    expect(handle).toHaveLength(32)
  })

  it('does not treat email addresses as mentions', () => {
    expect(extractMentionHandles('contact me at email@example.com')).toEqual([])
    expect(extractMentionHandles('plain text')).toEqual([])
  })
})

describe('newMentionHandles', () => {
  it('returns only handles added by the edit', () => {
    expect(newMentionHandles('hi @alice', 'hi @alice and @bob')).toEqual(['bob'])
  })

  it('returns nothing when no new handles', () => {
    expect(newMentionHandles('hi @alice', 'hello @alice!')).toEqual([])
  })

  it('treats case-variants as the same handle', () => {
    expect(newMentionHandles('hi @Alice', 'hi @alice')).toEqual([])
  })
})
