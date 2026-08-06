// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErrorDisplay } from './ErrorDisplay'

type ErrorObject = {
  name: string
  message: string
  instruction?: string
}

const networkError: ErrorObject = {
  name: 'NetworkError',
  message: '[error message]',
  instruction: '[error instruction]',
}

const otherError: ErrorObject = {
  name: 'OtherError',
  message: '[error message]',
  instruction: '[error instruction]',
}

describe('no error', () => {
  it('displays nothing', () => {
    const { container } = render(<ErrorDisplay errors={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('network error', () => {
  it('displays the network error message', () => {
    const { container } = render(<ErrorDisplay errors={[networkError]} />)

    expect(container).toHaveTextContent(
      "Hmm, it's silent here...[error message][error instruction]",
    )
  })
})

describe('non-network error', () => {
  it('links to the upstream troubleshooting guide, labelled as upstream', () => {
    const { container } = render(<ErrorDisplay errors={[otherError]} />)

    expect(container).toHaveTextContent(
      /OtherError: \[error message\]It seems some SQL statements couldn\’t make it through the parser\’s orbit/,
    )
    expect(
      screen.getByRole('link', {
        name: 'Check out the upstream troubleshooting guide →',
      }),
    ).toHaveAttribute('href', 'https://liambx.com/docs/parser/troubleshooting')
  })

  // The "Send a signal" callout pointed at upstream's discussions, which is the
  // wrong place to report a bug in this fork. Asserted absent so it cannot come
  // back unnoticed.
  it('does not send the user to upstream discussions', () => {
    render(<ErrorDisplay errors={[otherError]} />)

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toContain(
        'liam-hq/liam/discussions',
      )
    }
  })
})

describe('multiple errors', () => {
  it('displays the first error message', () => {
    const { container } = render(
      <ErrorDisplay errors={[networkError, otherError]} />,
    )

    expect(container).toHaveTextContent(
      "Hmm, it's silent here...[error message][error instruction]",
    )
  })
})
