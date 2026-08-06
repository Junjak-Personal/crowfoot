import Link from 'next/link'
import { urlgen } from '../../libs/routes'
import type { FormatType } from '../FormatIcon/FormatIcon'
import styles from './BranchDetailPageView.module.css'
import { SchemaFilePathForm } from './components/SchemaFilePathForm'

type Props = {
  projectId: string
  branchOrCommit: string
  project: {
    name: string
    schemaPath: {
      path: string
      format: FormatType
    } | null
  }
}

export const BranchDetailPageView = ({
  projectId,
  branchOrCommit,
  project,
}: Props) => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href={`/projects/${projectId}`} className={styles.backLink}>
            ← Back to Project
          </Link>
          <h1 className={styles.title}>
            {project.name} / {branchOrCommit}
          </h1>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.infoCard}>
          <h2 className={styles.sectionTitle}>Schema Configuration</h2>
          <div className={styles.resourceGrid}>
            <SchemaFilePathForm
              projectId={projectId}
              existingPath={project.schemaPath?.path}
              existingFormat={project.schemaPath?.format}
            />
            {project.schemaPath && (
              <div className={styles.resourceSection}>
                <h3 className={styles.resourceTitle}>ERD Diagrams</h3>
                <Link
                  href={urlgen(
                    'projects/[projectId]/ref/[branchOrCommit]/schema/[...schemaFilePath]',
                    {
                      projectId: String(projectId),
                      branchOrCommit,
                      schemaFilePath: project.schemaPath.path,
                    },
                  )}
                  className={styles.resourceLink}
                >
                  View ERD for {project.schemaPath.path}
                  <span className={styles.linkArrow}>→</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
