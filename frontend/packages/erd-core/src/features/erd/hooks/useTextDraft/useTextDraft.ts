// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { useState } from 'react'

/**
 * Keeps a text field showing what was typed into it, not what has come back.
 *
 * Fields whose value is stored on a React Flow node commit through
 * `useReactFlow().setNodes`, which queues its payload and flushes it in a
 * layout effect — so the render between the keystroke and the flush still
 * carries the *previous* text. Feeding that straight back into a controlled
 * field rewrites the box under the caret: the caret lands at the end, and an
 * in-flight IME composition is thrown away, which is how a Korean syllable
 * comes back apart into jamo.
 *
 * The draft owns the field from the first keystroke until it is left, so an
 * edit made elsewhere still shows up on a field nobody is typing in.
 */
export const useTextDraft = (committed: string) => {
  const [draft, setDraft] = useState<string | null>(null)

  return {
    value: draft ?? committed,
    /** From `onChange`, next to whatever commits the value. */
    edit: (text: string) => setDraft(text),
    /** From `onBlur`: hands the field back to `committed`. */
    release: () => setDraft(null),
  }
}
