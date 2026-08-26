import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { URL } from 'node:url'
import type { SchemaMeta } from '@crowfoot/schema/schema'
import { glob } from 'glob'
import { err, ok, type Result, ResultAsync } from 'neverthrow'

type Source = SchemaMeta['sources'][number]

type Input = {
  content: string
  /** What was read, in the order it was read, for `schema.json`'s `meta`. */
  sources: Source[]
}

/** Over the source bytes, so `sha256sum` on the input gives the same answer. */
const digest = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex')

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function isGitHubFileUrl(url: string): boolean {
  const parsedUrl = new URL(url)
  return parsedUrl.hostname === 'github.com' && url.includes('/blob/')
}

function normalizePathForGlob(inputPath: string): string {
  // Only convert backslashes on Windows to preserve Linux/macOS filenames with backslashes
  if (process.platform === 'win32') {
    return inputPath.replace(/\\/g, '/')
  }
  return inputPath

  // TODO: Consider using path.sep for a more elegant solution:
  // return inputPath.split(path.sep).join(path.posix.sep)
  // This approach is currently not adopted because our test suite doesn't run on Windows,
  // making it difficult to mock path.sep behavior accurately in tests.
  // Once we add Windows CI environment, we should revisit this implementation.
}

async function readLocalFiles(pattern: string): Promise<Result<Input, Error>> {
  const normalizedPattern = normalizePathForGlob(pattern)
  // Sorted: `glob` returns whatever order the filesystem hands it, and the
  // files are concatenated before parsing — so an unsorted read makes the same
  // input capable of producing two different schemas, and `meta.sources`
  // capable of listing them two different ways.
  const files = (await glob(normalizedPattern)).sort()
  if (files.length === 0) {
    return err(
      new Error(
        'No files found matching the pattern. Please provide valid file(s).',
      ),
    )
  }

  // Pre-validate file existence to avoid throwing inside async map
  const missing = files.find((filePath) => !fs.existsSync(filePath))
  if (missing) {
    return err(new Error(`File not found: ${missing}`))
  }

  const read = files.map((filePath) => {
    const bytes = fs.readFileSync(filePath)
    return {
      path: filePath,
      sha256: digest(bytes),
      text: bytes.toString('utf8'),
    }
  })

  return ok({
    content: read.map(({ text }) => text).join('\n'),
    sources: read.map(({ path, sha256 }) => ({ path, sha256 })),
  })
}

function downloadGitHubRawContent(
  githubUrl: string,
): ResultAsync<Input, Error> {
  const rawFileUrl = githubUrl
    .replace('github.com', 'raw.githubusercontent.com')
    .replace('/blob', '')
  // The URL that was asked for, not the raw one it was rewritten to: that is
  // the one someone reading `meta` would go back to.
  return downloadFile(rawFileUrl).map(({ content }) => ({
    content,
    sources: [
      { path: githubUrl, sha256: digest(Buffer.from(content, 'utf8')) },
    ],
  }))
}

function downloadFile(url: string): ResultAsync<Input, Error> {
  return ResultAsync.fromPromise(
    fetch(url).then(async (response) => {
      if (!response.ok) {
        return await Promise.reject(
          new Error(`Failed to download file: ${response.statusText}`),
        )
      }
      const text = await response.text()
      return {
        content: text,
        sources: [{ path: url, sha256: digest(Buffer.from(text, 'utf8')) }],
      }
    }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )
}

export async function getInputContent(
  inputPath: string,
): Promise<Result<Input, Error>> {
  if (!isValidUrl(inputPath)) {
    return await readLocalFiles(inputPath)
  }

  const resultAsync = isGitHubFileUrl(inputPath)
    ? downloadGitHubRawContent(inputPath)
    : downloadFile(inputPath)

  return await resultAsync
}
