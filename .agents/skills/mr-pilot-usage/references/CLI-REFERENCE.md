# CLI Reference

Complete reference for mr-pilot CLI options.

## Usage

```bash
node src/index.js <mr_url_or_id> [options]
```

## Positional Arguments

| Argument | Description |
|----------|-------------|
| `mr_url_or_id` | MR URL, MR ID, or PR URL. Can be full URL or just the number if project is configured. |

## Options

### `-c, --comment`
Post the review as a comment on the MR/PR.

**Example:**
```bash
node src/index.js 1930 --comment
```

### `-i, --input-file <path>`
Path to a file containing ticket/requirement specification. This is used to:
- Focus the review on specific requirements
- Enable scope analysis comparing changes against requirements
- The file should contain the PRD or acceptance criteria

**Example:**
```bash
node src/index.js 1930 -i criteria.txt
```

### `-g, --guidelines-file <path>`
Path to a project guidelines file. Guidelines reduce false positives by telling the LLM what to ignore.

**Example:**
```bash
node src/index.js 1930 -g guidelines.txt
```

Sample guidelines file:
```
# Ignore console.log statements (auto-disabled in production)
# Ignore camelCase VITE_ env variables (auto-normalized)
# Ignore missing E2E tests (in separate pipeline)
```

### `-p, --project <path>`
GitLab project path (e.g., `group/subgroup/project`). Required when using numeric MR ID without `GITLAB_DEFAULT_PROJECT` env var.

**Example:**
```bash
node src/index.js 1930 --project RD_soft/simpliciti-frontend/geored-v3
```

### `-m, --max-diff-chars <number>`
Maximum characters to include from the diff. Default is 50000. Use higher values for large MRs.

**Example:**
```bash
node src/index.js 1930 --max-diff-chars 200000
```

### `--platform <gitlab|github>`
Explicitly specify the platform when using numeric ID that could be ambiguous.

**Example:**
```bash
node src/index.js 1930 --platform gitlab
```

### `-d, --debug`
Show detailed debug information including:
- Full prompt sent to LLM
- Raw LLM response
- Ticket specification content
- Guidelines content

**Example:**
```bash
node src/index.js 1930 --debug
```

### `--fail-on-truncate`
Exit with error if the diff is truncated due to size limits. Useful for CI/CD pipelines.

**Example:**
```bash
node src/index.js 1930 --fail-on-truncate
```

### `-a, --acceptance-criteria <text>`
Add custom acceptance criteria text to the output. Displayed in both console and comment.

**Example:**
```bash
node src/index.js 1930 -a "Score must be > 70 to approve"
```

## Environment Variables

### Required for GitLab

| Variable | Description |
|----------|-------------|
| `GITLAB_TOKEN` | GitLab personal access token with `read_api` and `api` scopes |
| `GITLAB_API` | GitLab API URL (optional, defaults to gitlab.com) |
| `GITLAB_DEFAULT_PROJECT` | Default project path for numeric MR IDs |

### Required for GitHub

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub token with `repo` scope |

### LLM Configuration (one of)

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | OpenRouter API key (recommended) |
| `LLM_API_KEY` | Direct LLM API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic/Claude API key |

### Model Selection

| Variable | Example |
|----------|---------|
| `OPENROUTER_MODEL` | `google/gemini-3-flash-preview` |
| `LLM_MODEL` | `gpt-4o`, `claude-3-opus` |
| `LLM_API_URL` | Custom endpoint (e.g., for Groq) |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (invalid args, network failure, parse error) |

## Examples

### Complete GitLab Review with All Options

```bash
node src/index.js 1930 \
  --platform gitlab \
  --project RD_soft/simpliciti-frontend/geored-v3 \
  -i criteria.txt \
  -g guidelines.txt \
  -m 200000 \
  --comment \
  --debug
```

### GitHub PR Review

```bash
node src/index.js https://github.com/owner/repo/pull/456 \
  -i ticket-spec.md \
  --comment
```

### Preview Without Posting

```bash
node src/index.js 1930 -i criteria.txt -g guidelines.txt
```

### CI/CD Integration

```bash
# Exit with error if diff is truncated
node src/index.js $CI_MERGE_REQUEST_IID \
  --project $CI_PROJECT_PATH \
  -i ticket.md \
  --fail-on-truncate
```

## Performance Notes

- Large MRs (>50 files) may take 30+ seconds
- Use `--max-diff-chars` to limit processing time
- The tool fetches commits in addition to diffs (may be slow on some GitLab instances)