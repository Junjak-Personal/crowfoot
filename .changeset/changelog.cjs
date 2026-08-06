const {
  getInfo,
  getInfoFromPullRequest,
} = require('@changesets/get-github-info')

/**
 * @param {import('@changesets/types').Changeset} changeset
 * @param {import('@changesets/types').ChangelogOption} options
 * @returns {Promise<string>}
 */
const getChangesetEntry = async (changeset, options) => {
  if (!changeset || !changeset.summary) {
    return ''
  }

  let prFromSummary
  let commitFromSummary
  const usersFromSummary = []

  const replacedChangelog = changeset.summary
    .replace(/^\s*(?:pr|pull|pull\s+request):\s*#?(\d+)/im, (_, pr) => {
      const num = Number(pr)
      if (!Number.isNaN(num)) prFromSummary = num
      return ''
    })
    .replace(/^\s*commit:\s*([^\s]+)/im, (_, commit) => {
      commitFromSummary = commit
      return ''
    })
    .replace(/^\s*(?:author|user):\s*@?([^\s]+)/gim, (_, user) => {
      usersFromSummary.push(user)
      return ''
    })
    .trim()

  const [firstLine, ...futureLines] = replacedChangelog
    .split('\n')
    .map((l) => l.trimRight())

  let links = {
    commit: null,
    pull: null,
    user: null,
  }

  try {
    if (prFromSummary !== undefined) {
      const info = await getInfoFromPullRequest({
        repo: options.repo,
        pull: prFromSummary,
      }).catch(() => ({ links }))

      links = info?.links || links
      if (commitFromSummary) {
        const shortCommitId = commitFromSummary.slice(0, 7)
        links = {
          ...links,
          commit: `[\`${shortCommitId}\`](https://github.com/${options.repo}/commit/${commitFromSummary})`,
        }
      }
    } else if (changeset.commit) {
      const info = await getInfo({
        repo: options.repo,
        commit: changeset.commit,
      }).catch(() => ({ links: null }))

      if (info?.links) {
        links = {
          commit: info.links.commit,
          pull: info.links.pull,
          user: info.links.user,
        }
      }
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('Error fetching GitHub info:', error)
    }
  }

  const users = usersFromSummary.length
    ? usersFromSummary
        .map(
          (userFromSummary) =>
            `[@${userFromSummary}](https://github.com/${userFromSummary})`,
        )
        .join(', ')
    : links?.user || null

  const pullRequest = !links?.pull ? '' : ` ${links.pull}`
  const userInfo = !users ? '' : ` / Thanks ${users}!`

  if (!firstLine) return ''

  return `- ${pullRequest} - ${firstLine}${userInfo}${
    futureLines.length > 0
      ? `\n${futureLines.map((l) => `  ${l}`).join('\n')}`
      : ''
  }`
}

/**
 * @param {import('@changesets/types').Changeset} changeset
 * @param {import('@changesets/types').VersionType} _type
 * @param {import('@changesets/types').ChangelogOption} options
 */
const getReleaseLine = async (changeset, _type, options) => {
  return getChangesetEntry(changeset, options)
}

/**
 * @param {import('@changesets/types').Changeset[]} changesets
 * @param {import('@changesets/types').ModCompWithPackage[]} _dependenciesUpdated
 * @param {import('@changesets/types').ChangelogOption} options
 */
const getDependencyReleaseLine = async (
  changesets,
  _dependenciesUpdated,
  options,
) => {
  if (!changesets.length) return ''

  const entries = await Promise.all(
    changesets.map((changeset) => getChangesetEntry(changeset, options)),
  )

  return entries.filter(Boolean).join('\n')
}

/** @type {import('@changesets/types').ChangelogFunctions} */
const changelogFunctions = {
  getReleaseLine,
  getDependencyReleaseLine,
}

module.exports = changelogFunctions
