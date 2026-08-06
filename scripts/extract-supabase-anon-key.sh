#!/bin/bash

# Execute the supabase status command with env output format and capture its output
STATUS_OUTPUT=$(pnpm --filter @liam-hq/db exec supabase status -o env)

# Extract the anon key from the output
# Using grep to match the ANON_KEY line
ANON_KEY_LINE=$(echo "$STATUS_OUTPUT" | grep "^ANON_KEY=")

# Clean up and extract just the key value
# Remove ANON_KEY=" prefix and trailing "
ANON_KEY=$(echo "$ANON_KEY_LINE" | sed 's/^ANON_KEY="\(.*\)"$/\1/')

if [ -z "$ANON_KEY" ]; then
  echo "Failed to extract the anon key from Supabase status output"
  exit 1
fi

echo "Extracted anon key: $ANON_KEY"

# Check if .env file exists
if [ ! -f .env ]; then
  echo "error: .env file does not exist"
  exit 1
fi

# Check if NEXT_PUBLIC_SUPABASE_ANON_KEY already exists in .env
if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env; then
  # Replace the existing line
  sed -i.bak "s/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY/" .env
  rm -f .env.bak
  echo "Updated NEXT_PUBLIC_SUPABASE_ANON_KEY in .env file"
else
  # Append the new line
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY" >> .env
  echo "Added NEXT_PUBLIC_SUPABASE_ANON_KEY to .env file"
fi