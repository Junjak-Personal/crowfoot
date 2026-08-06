---
description: Create and run a standalone TypeScript debug script with minimal dependencies
---

## Purpose
Create a one-off TypeScript debug script for quick testing and debugging. The script should be self-contained with minimal external dependencies.

### Philosophy (CRITICAL - Read before every execution)
- **FACTS FIRST**: Real results always trump user expectations
- **CELEBRATE CONTRADICTIONS**: When results ≠ expectations, highlight this as the key finding
- **COMPLETE NEUTRALITY**: Report observations without bias toward user hypotheses
- **NEVER RATIONALIZE UNEXPECTED RESULTS**: They are the most valuable discoveries

## Constraints
- **Minimal imports** - Prefer Node.js built-ins and existing packages when possible
- **Single file** - Everything in one TypeScript file
- **Temporary nature** - Script may be deleted after use

## Decision Criteria

### Location Selection
```
IF debugging agent-related code:
  → frontend/internal-packages/agent/scripts/
ELSE IF debugging specific package:
  → [package-root]/scripts/
ELSE:
  → frontend/scripts/
```

### Naming Convention
- Pattern: `debug-[specific-purpose].ts`
- Examples:
  - `debug-multi-agent-supervisor.ts`
  - `debug-api-connection.ts`
  - `debug-memory-usage.ts`

## Implementation Steps

1. **Create directory** (if not exists):
   ```bash
   mkdir -p [chosen-location]/scripts
   ```

2. **Generate script** with this structure:
   ```typescript
   // How to run this script:
   // pnpm dlx tsx scripts/debug-[purpose].ts

   // === Configuration ===
   // If env vars needed, calculate path from script to root .env:
   // import { config } from 'dotenv'
   // import { resolve } from 'node:path'
   // config({ path: resolve(__dirname, '../../.env') }) // Adjust '../' count based on script depth
   // if (!process.env.REQUIRED_VAR) throw new Error('Failed to load .env')

   // === Debug Logic ===
   async function debug() {
     console.log('🔍 Debug execution:', '[purpose]')
     console.log('─'.repeat(50))

     // User's debug logic here

     console.log('─'.repeat(50))
     console.log('📊 Debug execution finished')
   }

   // === Execute ===
   debug().catch(err => {
     console.error('❌ Debug execution encountered exception:', err)
     process.exit(1)
   })
   ```

3. **Execute script**:
   ```bash
   cd [package-directory]
   pnpm dlx tsx scripts/debug-[purpose].ts
   ```

## Output Requirements
- Use emojis for visual clarity: 🔍 (execution), 📊 (completion), ❌ (error)
- Include timestamps for time-sensitive debugging
- Use separators for readability
- Show error messages with stack traces when exceptions occur

## Self-Check Before Finalizing Results
- [ ] Did I prioritize actual results over user expectations?
- [ ] If results contradict expectations, did I highlight this prominently?
- [ ] Am I rationalizing unexpected outcomes instead of celebrating them?
- [ ] Would a neutral observer agree with my interpretation?

## Post-Execution
- Ask user if they want to keep the script
- If temporary, offer to delete it

## Examples

### Example 1: Simple Value Check
```typescript
// User: "I want to debug the config values"
// Generated: frontend/internal-packages/agent/scripts/debug-config-values.ts

async function debug() {
  console.log('🔍 Debug execution: config values')
  console.log('API_URL:', process.env.API_URL)
  console.log('NODE_ENV:', process.env.NODE_ENV)
}
```

### Example 2: Async Operation Observation
```typescript
// User: "Check API connection behavior"
// Generated: frontend/internal-packages/agent/scripts/debug-api-connection.ts

async function debug() {
  console.log('🔍 Debug execution: API connection')
  const response = await fetch(process.env.API_URL + '/health')
  console.log('Response status:', response.status)
  console.log('Response headers:', Object.fromEntries(response.headers))
}
```

## Arguments
$ARGUMENTS