import { notFound } from 'next/navigation'
import { createClient } from '../../libs/db/server'
import { BranchDetailPageView } from './BranchDetailPageView'

type Props = {
  projectId: string
  branchOrCommit: string
}

async function getBranchDetails(projectId: string) {
  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_repository_mappings!inner (
        github_repositories (
          id,
          name,
          owner
        )
      )
    `)
    .eq('id', projectId)
    .single()

  if (error || !project) {
    console.error('Error fetching project:', error)
    notFound()
  }

  const { data: schemaPath, error: schemaPathError } = await supabase
    .from('schema_file_paths')
    .select('path, format')
    .eq('project_id', projectId)
    .single()

  if (schemaPathError) {
    console.warn(
      `No schema path found for project ${projectId}: ${JSON.stringify(schemaPathError)}`,
    )
  }

  const transformedSchemaPath = schemaPath
    ? { path: schemaPath.path, format: schemaPath.format }
    : null

  return {
    ...project,
    repository: project.project_repository_mappings[0]?.github_repositories,
    schemaPath: transformedSchemaPath,
  }
}

export const BranchDetailPage = async ({
  projectId,
  branchOrCommit,
}: Props) => {
  const project = await getBranchDetails(projectId)

  return (
    <BranchDetailPageView
      projectId={projectId}
      branchOrCommit={branchOrCommit}
      project={project}
    />
  )
}
