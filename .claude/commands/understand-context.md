---
description: Understand the current work status and project context
---

## Task
Run: `git status`

Then analyze the current work status including:
- Current branch
- Modified files
- Untracked files
- Staged changes

If git status shows no changes, fallback to:
- `gh pr diff` if current branch has an open PR
- `git diff origin/main` if changes are pushed but no PR exists

Provide a summary of the current work in progress.