import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withTimeoutAndAbort } from './withTimeoutAndAbort'

const expectSignalAborted = (signal: AbortSignal | null, expected: boolean) => {
  expect(signal).not.toBeNull()
  expect(signal).toBeInstanceOf(AbortSignal)
  if (signal !== null) {
    expect(signal.aborted).toBe(expected)
  }
}

describe('withTimeoutAndAbort', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns error when existing signal is already aborted', async () => {
    const abortedController = new AbortController()
    abortedController.abort()

    const mockFn = vi.fn().mockResolvedValue(undefined)

    const result = await withTimeoutAndAbort(
      mockFn,
      1000,
      abortedController.signal,
    )

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toBe('Request already aborted')
    }
    expect(mockFn).not.toHaveBeenCalled()
  })

  it('returns success when function completes without timeout or abort', async () => {
    const controller = new AbortController()
    const mockFn = vi.fn().mockResolvedValue(undefined)

    const result = await withTimeoutAndAbort(mockFn, 1000, controller.signal)

    expect(result.isOk()).toBe(true)
    expect(mockFn).toHaveBeenCalledTimes(1)
    expect(mockFn).toHaveBeenCalledWith(expect.any(AbortSignal))
  })

  it('handles function completion when timeout expires', async () => {
    const controller = new AbortController()
    let receivedSignal: AbortSignal | null = null

    const mockFn = vi.fn().mockImplementation((signal: AbortSignal) => {
      receivedSignal = signal
      return new Promise<void>((resolve) => {
        // Simulate long-running operation that responds to abort
        signal.addEventListener('abort', () => resolve())
      })
    })

    const resultPromise = withTimeoutAndAbort(mockFn, 1000, controller.signal)

    // Fast-forward time to trigger timeout
    vi.advanceTimersByTime(1000)

    const result = await resultPromise

    expect(mockFn).toHaveBeenCalledTimes(1)
    expectSignalAborted(receivedSignal, true)
    expect(result.isOk()).toBe(true)
  })

  it('handles function completion when existing signal is aborted during execution', async () => {
    const controller = new AbortController()
    let receivedSignal: AbortSignal | null = null

    const mockFn = vi.fn().mockImplementation((signal: AbortSignal) => {
      receivedSignal = signal
      return new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve())
      })
    })

    const resultPromise = withTimeoutAndAbort(mockFn, 5000, controller.signal)

    // Abort the existing signal before timeout
    controller.abort()

    const result = await resultPromise

    expect(mockFn).toHaveBeenCalledTimes(1)
    expectSignalAborted(receivedSignal, true)
    expect(result.isOk()).toBe(true)
  })

  it('does not trigger timeout when function completes quickly', async () => {
    const controller = new AbortController()
    let receivedSignal: AbortSignal | null = null

    const mockFn = vi.fn().mockImplementation((signal: AbortSignal) => {
      receivedSignal = signal
      return Promise.resolve()
    })

    const result = await withTimeoutAndAbort(mockFn, 1000, controller.signal)

    // Function should complete without being aborted
    expect(result.isOk()).toBe(true)
    expect(mockFn).toHaveBeenCalledTimes(1)
    expectSignalAborted(receivedSignal, false)
  })

  it('propagates function errors correctly', async () => {
    const controller = new AbortController()
    const testError = new Error('Function error')
    const mockFn = vi.fn().mockRejectedValue(testError)

    const result = await withTimeoutAndAbort(mockFn, 1000, controller.signal)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBe(testError)
    }
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('provides fresh abort signal to function that differs from existing signal', async () => {
    const controller = new AbortController()
    let receivedSignal: AbortSignal | null = null

    const mockFn = vi.fn().mockImplementation((signal: AbortSignal) => {
      receivedSignal = signal
      return Promise.resolve()
    })

    const result = await withTimeoutAndAbort(mockFn, 1000, controller.signal)

    expect(result.isOk()).toBe(true)
    expect(receivedSignal).not.toBe(controller.signal)
    expect(receivedSignal).toBeInstanceOf(AbortSignal)
  })
})
