'use server'

import { revalidatePath } from 'next/cache'
import * as v from 'valibot'
import { getOrganizationId } from '../../../features/organizations/services/getOrganizationId'
import { createClient } from '../../../libs/db/server'

const schemaFilePathSchema = v.object({
  projectId: v.string(),
  path: v.pipe(v.string(), v.minLength(1, 'Path is required')),
  format: v.picklist(['schemarb', 'postgres', 'prisma', 'tbls']),
})

type SchemaFilePathInput = v.InferOutput<typeof schemaFilePathSchema>

export async function saveSchemaFilePath(
  _prevState: {
    success: boolean
    error: string | null
    message: string | null
  },
  formData: FormData,
): Promise<{ success: boolean; error: string | null; message: string | null }> {
  const rawData = {
    projectId: formData.get('projectId'),
    path: formData.get('path'),
    format: formData.get('format'),
  }

  const result = v.safeParse(schemaFilePathSchema, rawData)
  if (!result.success) {
    return {
      success: false,
      error: result.issues[0]?.message || 'Invalid input',
      message: null,
    }
  }

  const { projectId, path, format }: SchemaFilePathInput = result.output

  const organizationIdResult = await getOrganizationId()
  if (organizationIdResult.isErr()) {
    return {
      success: false,
      error: organizationIdResult.error.message,
      message: null,
    }
  }
  const organizationId = organizationIdResult.value

  const supabase = await createClient()

  // Currently, each project can only have one schema file associated with it.
  // We use onConflict: 'project_id' to update the existing record if it exists.
  // TODO: If multiple schema files per project are needed in the future,
  // this logic will need to be revised to handle multiple records.
  const { error } = await supabase.from('schema_file_paths').upsert(
    {
      project_id: projectId,
      path: path.trim(),
      format,
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'project_id',
    },
  )

  if (error) {
    return {
      success: false,
      error: 'Failed to save schema file path',
      message: null,
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return {
    success: true,
    error: null,
    message: 'Schema file path saved successfully',
  }
}
