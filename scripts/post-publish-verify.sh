#!/usr/bin/env bash
# Post-publish verification for @traits-dev packages.
# Run from any directory after a publish to verify consumer experience.
# Expected runtime: under 2 minutes.
#
# Usage:
#   ./scripts/post-publish-verify.sh
#   ./scripts/post-publish-verify.sh 0.7.4 0.2.0  # explicit core/integration versions

set -euo pipefail

CORE_VERSION="${1:-latest}"
INTEGRATION_VERSION="${2:-latest}"

DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT

echo "=== Post-Publish Verification ==="
echo "Working directory: $DIR"
echo "Core/CLI version: $CORE_VERSION"
echo "Vercel/MCP version: $INTEGRATION_VERSION"
echo ""

cd "$DIR"

# --- Step 1: Init clean ESM project ---
echo "--- Step 1: Init clean project ---"
npm init -y --silent
node -e "const p=require('./package.json'); p.type='module'; require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"
echo "PASS: project init"

# --- Step 2: Install all packages ---
echo ""
echo "--- Step 2: Install packages from npm ---"
npm install \
  "@traits-dev/core@$CORE_VERSION" \
  "@traits-dev/cli@$CORE_VERSION" \
  "@traits-dev/vercel@$INTEGRATION_VERSION" \
  "@traits-dev/mcp@$INTEGRATION_VERSION" \
  --silent
echo "PASS: all packages installed (0 errors)"

# --- Step 3: Core imports + runtime ---
echo ""
echo "--- Step 3: Core smoke test ---"
node -e "
import { validateResolvedProfile, compileResolvedProfile, injectPersonality } from '@traits-dev/core';
const profile = {
  schema: 'v1.6',
  meta: { name: 'Verify', version: '1.0', description: 'Post-publish check' },
  identity: { role: 'assistant' },
  voice: { formality: 'medium', warmth: 'high', verbosity: 'low', directness: 'high', empathy: 'high', humor: 'low' }
};
const v = validateResolvedProfile(profile);
if (v.effectiveErrors.length > 0) throw new Error('validation failed');
const c = compileResolvedProfile(profile, { model: 'gpt-4o' });
if (!c.text || c.text.length < 100) throw new Error('compile failed');
const s = injectPersonality({ compiledPersonality: c, system: 'You are helpful.', model: 'gpt-4o' });
if (!s.includes('You are helpful')) throw new Error('inject failed');
console.log('PASS: core validate + compile + inject');
"

# --- Step 4: Vercel wrapper ---
echo ""
echo "--- Step 4: Vercel smoke test ---"
node -e "
import { withPersonality } from '@traits-dev/vercel';
const mock = { specificationVersion: 'v3', provider: 'test', modelId: 'gpt-4o', doGenerate: async()=>({}), doStream: async()=>({}) };
const profile = {
  schema: 'v1.6',
  meta: { name: 'Verify', version: '1.0', description: 'check' },
  identity: { role: 'assistant' },
  voice: { formality: 'medium', warmth: 'high', verbosity: 'low', directness: 'high', empathy: 'high', humor: 'low' }
};
const w = withPersonality(mock, profile, { model: 'gpt-4o' });
if (!w.modelId) throw new Error('wrapper failed');
console.log('PASS: vercel withPersonality wraps model');
"

# --- Step 5: MCP server startup + tools ---
echo ""
echo "--- Step 5: MCP smoke test ---"
INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"verify","version":"1.0"}}}'
NOTIFY='{"jsonrpc":"2.0","method":"notifications/initialized"}'
TOOLS='{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
RESPONSE=$(printf '%s\n%s\n%s\n' "$INIT" "$NOTIFY" "$TOOLS" | timeout 5 node node_modules/@traits-dev/mcp/dist/index.js 2>/dev/null || true)

if echo "$RESPONSE" | grep -q "traits_validate"; then
  echo "PASS: MCP server starts and exposes tools"
else
  echo "FAIL: MCP tools not found in response"
  echo "$RESPONSE"
  exit 1
fi

# --- Step 6: CLI binary ---
echo ""
echo "--- Step 6: CLI binary test ---"
npx @traits-dev/cli --help > /dev/null 2>&1 || npx traits --help > /dev/null 2>&1
echo "PASS: CLI binary executes"

# --- Step 7: Tarball artifact check ---
echo ""
echo "--- Step 7: Tarball artifacts ---"
CORE_FILES=$(npm pack "@traits-dev/core@$CORE_VERSION" --dry-run 2>&1 | grep -c "dist/")
VERCEL_FILES=$(npm pack "@traits-dev/vercel@$INTEGRATION_VERSION" --dry-run 2>&1 | grep -c "dist/")
MCP_PROFILES=$(npm pack "@traits-dev/mcp@$INTEGRATION_VERSION" --dry-run 2>&1 | grep -c "profiles/")
echo "core dist files: $CORE_FILES"
echo "vercel dist files: $VERCEL_FILES"
echo "mcp profile files: $MCP_PROFILES"
if [ "$CORE_FILES" -ge 6 ] && [ "$VERCEL_FILES" -ge 4 ] && [ "$MCP_PROFILES" -ge 7 ]; then
  echo "PASS: all tarballs contain expected artifacts"
else
  echo "FAIL: missing artifacts"
  exit 1
fi

echo ""
echo "=== ALL CHECKS PASSED ==="
