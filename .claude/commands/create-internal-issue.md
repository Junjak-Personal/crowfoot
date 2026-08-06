---
description: Create an issue in the route06/liam-internal repository
---

## Task
Create a new issue in the route06/liam-internal repository using the GitHub CLI.

Follow the general issue creation guidelines in @.claude/commands/create-issue.md with the following specific requirements:

### Repository-Specific Requirements
- **Repository**: `route06/liam-internal`
- **Language**: Write both the issue title **and** body in Japanese
- **Command**: Use `gh issue create --repo route06/liam-internal`

### Arguments
$ARGUMENTS

See @.claude/commands/create-issue.md for argument handling guidelines.

### Examples
- Simple issue: `/create-internal-issue "バグ: データベース接続タイムアウト"`
- Complex feature: `/create-internal-issue "現在のログイン方法を改善したい - 詳細な要件があります"`
- Context-based: `/create-internal-issue "create an issue from what we just discussed"`
- Empty args: `/create-internal-issue` (suggest auto-detection from conversation)

### Best Practices
Follow the best practices in @.claude/commands/create-issue.md with special attention to:
- **Cross-repository references**: When referencing PRs or issues from repositories other than route06/liam-internal (e.g., liam-hq/liam), use the full format `repository#number` (e.g., `liam-hq/liam#2991`) instead of just `#number` to ensure proper GitHub linking