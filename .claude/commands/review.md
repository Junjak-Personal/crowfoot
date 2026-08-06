---
description: Run CodeRabbit CLI directly on local changes and create actionable tasks
allowed-tools: Bash(coderabbit:*), BashOutput, TodoWrite
---

# CodeRabbit CLI Review (Local changes only)

Do NOT check or review pull requests. Do NOT call `gh` commands.
Run CodeRabbit locally against the working repository only.

## Run

Execute exactly:

```bash
coderabbit --plain -t all --base origin/main -c claude.md coderabbit.yaml
```

## Parse → Tasks

From the output, extract for each finding:

* Severity: Critical | Warning | Info
* File and line
* Description
* Suggested fix

Create one TodoWrite per finding:

* `title`: `[Severity] <file>:<line> <short description>`
* `body`: `<Suggested fix>`
* `metadata`: `{ "file": "<file>", "line": <line>, "severity": "<Severity>" }`
