---
description: Run integration tests in the agent package
---

## Task
Run integration tests in the frontend/internal-packages/agent package.

**Execution:**
Changes to `frontend/internal-packages/agent` directory and runs tests in the background:
- With arguments: `pnpm test:integration [arguments]`
- Without arguments: `pnpm test:integration` (after confirmation)

**If no arguments provided:**
1. Show a warning that running all integration tests will make multiple OpenAI API calls, which may take significant time and incur costs
2. Ask: "Please respond with 'yes' if you'd like to proceed"
3. Only execute if user confirms

**If arguments provided:**
Execute directly without confirmation (assumes targeted test execution)

**Background Execution:**
1. Execute the command in the background using Bash tool with `run_in_background: true`
2. Check the output every 2 minutes using BashOutput tool
3. Continue checking until the tests complete
4. Report the final results to the user

### Usage Examples
- Specific file: `src/pm-agent/nodes/analyzeRequirementsNode.integration.test.ts`  
- File name: `analyzeRequirementsNode.integration.test.ts`
- All tests: (no arguments - requires confirmation)

### Arguments
$ARGUMENTS