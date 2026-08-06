---
description: Parse schema for dataset - Convert SQL/schema files to JSON benchmark datasets
---

# Parse Schema for Dataset

## Task

Parse the specified schema file (SQL, Prisma, Drizzle, etc.) to JSON format and save it to the benchmark reference directory at `frontend/internal-packages/schema-bench/benchmark-workspace-default/execution/reference/`.

### Process

1. Identify the input schema file format (postgres, prisma, drizzle, tbls, schemarb)
2. Use the @liam-hq/schema parser to convert to JSON
3. Save the output to an appropriately named case file in the benchmark reference directory
4. Verify the generated JSON structure matches the expected format

### Arguments

$ARGUMENTS

Expected arguments:

- Input file path (SQL or schema file)
- Output case name (e.g., "case-002", "case-003")
- Format (optional - will auto-detect if not provided)

Example usage:
`/parse-schema-for-dataset schema.sql case-002`
`/parse-schema-for-dataset prisma/schema.prisma case-003 --format prisma`