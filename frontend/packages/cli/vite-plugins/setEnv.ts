import { execSync } from 'node:child_process'
import { loadEnv, type Plugin } from 'vite'

/**
 * This Vite plugin initializes and sets the following environment variables for the client-side environment:
 * - VITE_CLI_VERSION_VERSION: The current version of the package from package.json.
 * - VITE_CLI_VERSION_IS_RELEASED_GIT_HASH: A flag indicating whether the current GIT hash corresponds to a released tag.
 * - VITE_CLI_VERSION_GIT_HASH: The current GIT commit hash.
 * - VITE_CLI_VERSION_DATE: The commit date of the latest commit.
 * - VITE_CLI_VERSION_ENV_NAME: Environment name (preview or production).
 *
 * These variables are essential for maintaining version consistency and tracking within the deployment environment.
 */
export function setEnvPlugin(): Plugin {
  const fetchGitHash = () => {
    try {
      return execSync('git rev-parse HEAD').toString().trim()
    } catch (error) {
      console.error('Failed to get git hash:', error)
      return ''
    }
  }

  const fetchGitBranch = () => {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
    } catch (error) {
      console.error('Failed to get git branch:', error)
      return ''
    }
  }

  const date = () => {
    try {
      const gitDate = execSync('git log -1 --format=%ci').toString().trim()
      return gitDate.split(' ')[0]
    } catch (error) {
      console.error('Failed to get git date:', error)
      return new Date().toISOString().split('T')[0] // fallback to current date
    }
  }

  const versionPrefix = 'v'

  // Resolves the release tag locally only — no network I/O. Returns 0 if the
  // tag doesn't exist yet (e.g. a build made before the release tag is pushed).
  //
  // `^{commit}` is load-bearing: release tags are annotated, and a bare
  // `git rev-parse v0.1.0` yields the tag *object* hash, which never equals a
  // commit hash — so the comparison would silently never match. Left unquoted
  // on purpose: `^` is not special to POSIX shells and `{commit}` is not a
  // brace expansion, while cmd.exe would pass single quotes through literally.
  const isReleasedGitHash = (gitHash: string, packageJsonVersion: string) => {
    const latestTagName = `${versionPrefix}${packageJsonVersion}`
    try {
      const tagCommit = execSync(`git rev-parse ${latestTagName}^{commit}`)
        .toString()
        .trim()
      return gitHash === tagCommit ? 1 : 0
    } catch {
      return 0 // Tag doesn't exist locally
    }
  }

  return {
    name: 'set-env',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '')

      const packageJsonVersion = env.npm_package_version
      const gitHash = fetchGitHash()
      const gitBranch = fetchGitBranch()

      // The master branch (this repo's default) is considered production, all
      // other branches are treated as previews.
      const envName = gitBranch === 'master' ? 'production' : 'preview'

      process.env.VITE_CLI_VERSION_VERSION = packageJsonVersion
      process.env.VITE_CLI_VERSION_IS_RELEASED_GIT_HASH = JSON.stringify(
        isReleasedGitHash(gitHash, packageJsonVersion),
      )
      process.env.VITE_CLI_VERSION_GIT_HASH = gitHash
      process.env.VITE_CLI_VERSION_ENV_NAME = envName
      process.env.VITE_CLI_VERSION_DATE = date()
    },
  }
}
