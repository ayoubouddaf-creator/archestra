#!/bin/bash
# Run this from the platform/ directory to commit the #3859 implementation
set -e

cd "$(dirname "$0")"

git add \
  frontend/src/app/mcp/registry/_parts/mcp-catalog-form.utils.ts \
  frontend/src/app/mcp/registry/_parts/mcp-catalog-form.utils.test.ts \
  frontend/src/app/mcp/registry/_parts/mcp-catalog-form.tsx

git commit -m "feat: support JSON array format in MCP server arguments field

Implements #3859 — the Arguments textarea in the MCP server form now
accepts both formats:

  • One argument per line (existing behavior, unchanged)
  • JSON array, e.g. [\"--port\", \"8080\"]  (new)

The JSON array format is common in Claude Desktop configs and other MCP
tooling, so users can paste those configs directly without manually
converting each element to its own line.

Changes:
- Extract parseArgumentsString() helper in mcp-catalog-form.utils.ts
  that tries JSON.parse when the input starts with '[', with newline-
  split as the fallback for plain text or malformed JSON
- Update the Arguments field label from 'Arguments (one per line)' to
  'Arguments' and add a FormDescription explaining both formats
- Update the placeholder to show both format examples
- Add comprehensive unit tests for parseArgumentsString"

echo "Done! Run 'git push' to push."
