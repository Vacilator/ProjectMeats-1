# ShellCheck Guidelines for GitHub Workflows

This document outlines ShellCheck best practices to prevent CI failures in workflow YAML files.

## Common Issues & Fixes

### SC2086: Double quote to prevent globbing and word splitting

**Problem**: Unquoted variable expansion
```bash
# ❌ BAD
git rev-parse origin/$BRANCH
echo value >> $GITHUB_OUTPUT
```

**Solution**: Add double quotes
```bash
# ✅ GOOD
git rev-parse "origin/$BRANCH"
echo value >> "$GITHUB_OUTPUT"
```

### SC2129: Use grouped redirect for multiple echo statements

**Problem**: Multiple redirects to same file
```bash
# ❌ BAD
echo "Line 1" >> $GITHUB_STEP_SUMMARY
echo "Line 2" >> $GITHUB_STEP_SUMMARY
echo "Line 3" >> $GITHUB_STEP_SUMMARY
```

**Solution**: Group with single redirect
```bash
# ✅ GOOD
{
  echo "Line 1"
  echo "Line 2"
  echo "Line 3"
} >> "$GITHUB_STEP_SUMMARY"
```

## Quick Reference

### Variables in Shell Scripts
- **Always quote**: `"$VAR"`, `"${VAR}"`, `"$GITHUB_OUTPUT"`
- **Exception**: When word-splitting is intentional (use `# shellcheck disable=SC2086`)

### File Redirects
- **Single output**: `echo "text" >> "$FILE"`
- **Multiple outputs**: Use `{ ... } >> "$FILE"` pattern

### Conditionals
- **Always quote test operands**: `[ "$A" = "$B" ]`
- **Use `[[` for advanced tests**: `[[ $VAR =~ pattern ]]`

## Workflow-Specific Patterns

### GitHub Actions Output
```bash
# ✅ Correct pattern
echo "key=value" >> "$GITHUB_OUTPUT"
echo "multi_line<<EOF" >> "$GITHUB_OUTPUT"
echo "$CONTENT" >> "$GITHUB_OUTPUT"
echo "EOF" >> "$GITHUB_OUTPUT"
```

### GitHub Step Summary
```bash
# ✅ Correct pattern for multiple lines
{
  echo "## Header"
  echo ""
  echo "Content line 1"
  echo "Content line 2"
} >> "$GITHUB_STEP_SUMMARY"
```

### Variable Expansion in Echo
```bash
# ✅ Safe - variables in double-quoted strings
echo "Value: $VAR"
echo "Path: ${VAR}/subpath"

# ⚠️ Unsafe - unquoted in command substitution context
some_command $VAR  # Use: some_command "$VAR"
```

## Testing Locally

If ShellCheck is installed:
```bash
# Check a specific workflow
shellcheck <(cat .github/workflows/main-pipeline.yml | yq eval '.jobs.*.steps[].run' -)

# Or extract and check all run blocks
find .github/workflows -name "*.yml" -exec grep -A20 "run: |" {} \;
```

## When ShellCheck Fails

1. **Read the error code** (e.g., SC2086, SC2129)
2. **Check this guide** for the fix pattern
3. **Apply the fix** to all similar instances (search globally)
4. **Test with PR** - validation runs on every PR

## Exceptions

Only disable ShellCheck when absolutely necessary:
```bash
# shellcheck disable=SC2086
intentional_word_splitting $LIST_OF_ARGS
```

## Summary of Fixes (2026-02-18)

- **PR #2990**: Quoted `$BRANCH` in git rev-parse
- **PR #2993**: Quoted `$GITHUB_OUTPUT` redirects (3x)
- **PR #2994**: Grouped `$GITHUB_STEP_SUMMARY` redirects (5 blocks, 28 lines → 5 redirects)

**Result**: All ShellCheck SC2086 and SC2129 errors eliminated from workflows.
