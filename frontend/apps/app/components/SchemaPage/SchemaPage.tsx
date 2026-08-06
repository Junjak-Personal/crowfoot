import path from 'node:path'
import { getFileContent } from '@liam-hq/github'
import {
  parse,
  type SupportedFormat,
  setPrismWasmUrl,
  supportedFormatSchema,
} from '@liam-hq/schema/parser'
import { TabsContent, TabsRoot } from '@liam-hq/ui'
import * as Sentry from '@sentry/nextjs'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ComponentProps, FC } from 'react'
import * as v from 'valibot'
import { createClient } from '../../libs/db/server'
import type { FormatType } from '../FormatIcon'
import { ERDEditor } from './components/ERDEditor'
import { SchemaHeader } from './components/SchemaHeader'
import { DEFAULT_SCHEMA_TAB, SCHEMA_TAB } from './constants'
import styles from './SchemaPage.module.css'

type Params = {
  projectId: string
  branchOrCommit: string
  schemaFilePath: string
}

type Response = ComponentProps<typeof ERDEditor>

type SchemaHeaderFormat = Exclude<SupportedFormat, 'drizzle' | 'liam'>

// TODO: Use supportedFormatSchema directly once the UI handles 'drizzle' and 'liam'.
const parseSchemaHeaderFormat = (value: unknown): SchemaHeaderFormat | null => {
  const result = v.safeParse(supportedFormatSchema, value)
  if (!result.success) {
    return null
  }

  const format = result.output
  if (format === 'drizzle' || format === 'liam') {
    return null
  }

  return format
}

async function getERDEditorContent({
  projectId,
  branchOrCommit,
  schemaFilePath,
}: Params): Promise<Response> {
  const blankSchema = { tables: {}, enums: {}, extensions: {} }
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select(`
        *,
        project_repository_mappings(
          *,
          github_repositories(
            name, owner, github_installation_identifier
          )
        )
      `)
    .eq('id', projectId)
    .single()

  const { data: gitHubSchemaFilePath } = await supabase
    .from('schema_file_paths')
    .select('path, format')
    .eq('project_id', projectId)
    .eq('path', schemaFilePath)
    .maybeSingle()

  const repository =
    project?.project_repository_mappings[0]?.github_repositories
  if (
    !repository?.github_installation_identifier ||
    !repository.owner ||
    !repository.name
  ) {
    console.error('Repository information not found')
    notFound()
  }

  const repositoryFullName = `${repository.owner}/${repository.name}`
  const { content } = await getFileContent(
    repositoryFullName,
    schemaFilePath,
    branchOrCommit,
    repository.github_installation_identifier,
  )

  if (!content) {
    return {
      schema: blankSchema,
      defaultSidebarOpen: false,
      errorObjects: [
        {
          name: 'FileNotFound',
          message: 'The specified file could not be found in the repository.',
          instruction:
            'Please check the file path and branch/commit reference.',
        },
      ],
      projectId,
      branchOrCommit,
    }
  }

  setPrismWasmUrl(path.resolve(process.cwd(), 'prism.wasm'))

  if (!gitHubSchemaFilePath?.format) {
    return {
      schema: blankSchema,
      defaultSidebarOpen: false,
      errorObjects: [
        {
          name: 'FormatError',
          message: 'Record not found',
          instruction: 'Please make sure that the schema file exists.',
        },
      ],
      projectId,
      branchOrCommit,
    }
  }

  const format = gitHubSchemaFilePath.format
  const { value: schema, errors } = await parse(content, format)

  for (const error of errors) {
    Sentry.captureException(error)
  }

  const cookieStore = await cookies()
  const defaultSidebarOpen = cookieStore.get('sidebar:state')?.value === 'true'
  const layoutCookie = cookieStore.get('panels:layout')
  const defaultPanelSizes = (() => {
    if (!layoutCookie) return [20, 80]
    try {
      const sizes = JSON.parse(layoutCookie.value)
      if (Array.isArray(sizes) && sizes.length >= 2) return sizes
    } catch {}
    return [20, 80]
  })()

  return {
    schema,
    defaultSidebarOpen,
    defaultPanelSizes,
    errorObjects: errors.map((error: Error) => ({
      name: error.name,
      message: error.message,
    })),
    projectId,
    branchOrCommit,
  }
}

type Props = {
  projectId: string
  branchOrCommit: string
  schemaFilePath: string
}

export const SchemaPage: FC<Props> = async ({
  projectId,
  branchOrCommit,
  schemaFilePath,
}) => {
  const contentProps = await getERDEditorContent({
    projectId,
    branchOrCommit,
    schemaFilePath,
  })

  const supabase = await createClient()

  const { data: projectRows } = await supabase
    .from('projects')
    .select(
      `
        schema_file_paths!inner (
          path,
          format
        ),
        project_repository_mappings (
          github_repositories (
            owner,
            name
          )
        )
      `,
    )
    .eq('id', projectId)
    .eq('schema_file_paths.path', schemaFilePath)
  const projectData = projectRows?.[0]

  const gitHubSchemaFilePath = projectData?.schema_file_paths?.[0] ?? null

  const schemaHeaderFormat = gitHubSchemaFilePath
    ? parseSchemaHeaderFormat(gitHubSchemaFilePath.format)
    : null

  const repositoryMappings =
    projectRows?.flatMap((row) => row.project_repository_mappings ?? []) ?? []

  const repository =
    repositoryMappings
      .map((mapping) => mapping.github_repositories)
      .find(Boolean) ?? null

  const repositoryOwner = repository?.owner
  const repositoryName = repository?.name

  const schemaHeader: {
    schemaName: string
    format: FormatType
    href: string
  } | null =
    gitHubSchemaFilePath &&
    schemaHeaderFormat &&
    repositoryOwner &&
    repositoryName
      ? {
          schemaName: path.basename(gitHubSchemaFilePath.path),
          format: schemaHeaderFormat,
          href: `https://github.com/${repositoryOwner}/${repositoryName}/blob/${encodeURIComponent(
            branchOrCommit,
          )}/${gitHubSchemaFilePath.path
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`,
        }
      : null

  return (
    <TabsRoot defaultValue={DEFAULT_SCHEMA_TAB} className={styles.wrapper}>
      {schemaHeader ? (
        <SchemaHeader
          schemaName={schemaHeader.schemaName}
          format={schemaHeader.format}
          href={schemaHeader.href}
        />
      ) : null}
      <TabsContent value={SCHEMA_TAB.ERD} className={styles.tabsContent}>
        <ERDEditor {...contentProps} />
      </TabsContent>
    </TabsRoot>
  )
}
