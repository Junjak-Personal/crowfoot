import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

// This is a static route, so it will be rendered at build time
export const dynamic = 'force-static'

const getRawContents = (dirPath: string): string[] => {
  const results: string[] = []
  let rootIndexContent: string | null = null

  const list = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const file of list) {
    const filePath = path.resolve(dirPath, file.name)

    if (file.isDirectory()) {
      results.push(...getRawContents(filePath))
    } else if (file.name.endsWith('.mdx')) {
      const content = fs.readFileSync(filePath, 'utf8')
      if (
        filePath === path.resolve(dirPath, 'index.mdx') &&
        dirPath === path.resolve(process.cwd(), 'content/docs')
      ) {
        rootIndexContent = content
      } else {
        results.push(content)
      }
    }
  }

  if (rootIndexContent) {
    results.unshift(rootIndexContent)
  }

  return results
}

export function GET() {
  const rawContents = getRawContents(
    path.resolve(process.cwd(), 'content/docs'),
  )

  const content = `# Liam ERD

${rawContents.join('\n\n')}
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
