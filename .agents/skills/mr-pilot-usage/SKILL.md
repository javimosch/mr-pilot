---
name: mr-pilot-usage
description: Use mr-pilot CLI to perform AI-powered code reviews on GitLab Merge Requests and GitHub Pull Requests. Use when user asks for MR/PR review, code review automation, requests AI feedback on merge requests, or needs automated review comments posted to MRs.
compatibility: Requires Node.js 14+, mr-pilot CLI installed, and environment variables (GITLAB_TOKEN or GITHUB_TOKEN for API access, plus LLM API key via OPENROUTER_API_KEY or other supported providers).
metadata:
  author: mr-pilot
  version: "1.2.0"
  repository: https://github.com/javimosch/mr-pilot
---

# mr-pilot: AI Code Review CLI

This skill teaches agents how to use mr-pilot to perform automated AI code reviews on GitLab MRs and GitHub PRs.

## When to Use This Skill

Invoke this skill when:
- User requests code review of a GitLab MR or GitHub PR
- User wants AI feedback on code changes
- User asks to "review" or "analyze" a merge/pull request
- User wants to post automated review comments to an MR/PR
- User provides a ticket specification and wants to verify implementation against requirements

## Prerequisites

### Environment Variables Required

**For GitLab MRs:**
```bash
GITLAB_TOKEN=glpat-xxxx
GITLAB_API=https://git.geored.fr/api/v4  # optional, default is gitlab.com
GITLAB_DEFAULT_PROJECT=group/subgroup/project  # optional, for shorter MR IDs
```

**For GitHub PRs:**
```bash
GITHUB_TOKEN=ghp_xxxx
```

**For LLM (OpenRouter example):**
```bash
OPENROUTER_API_KEY=sk-or-v1-xxxx
OPENROUTER_MODEL=google/gemini-3-flash-preview
```

### Installation

```bash
git clone https://github.com/javimosch/mr-pilot.git
cd mr-pilot
npm install
# Configure .env file with tokens
```

## Basic Usage

### Review MR without posting comment (preview only):

```bash
cd /path/to/mr-pilot
node src/index.js <mr_url_or_id>
```

### Review and post comment to MR:

```bash
node src/index.js <mr_url_or_id> --comment
```

## Common Command Patterns

### GitLab MR Review with Ticket Specification

When reviewing an MR against specific requirements:

```bash
node src/index.js 1930 \
  --platform gitlab \
  -i /path/to/ticket-spec.txt \
  -g /path/to/guidelines.txt \
  --comment
```

### GitHub PR Review

```bash
node src/index.js https://github.com/owner/repo/pull/123 \
  --comment
```

### Large MRs (increase diff size limit)

```bash
node src/index.js 1930 --max-diff-chars 200000 --comment
```

### Debug Mode (see full prompt sent to LLM)

```bash
node src/index.js 1930 -i criteria.txt --debug
```

## Key Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--comment` | `-c` | Post review as comment on MR/PR |
| `--input-file` | `-i` | Path to ticket/requirement specification file |
| `--guidelines-file` | `-g` | Path to project guidelines (reduces false positives) |
| `--project` | `-p` | GitLab project path (e.g., group/subgroup/project) |
| `--max-diff-chars` | `-m` | Maximum characters for diffs (default: 50000) |
| `--platform` | - | Specify platform: `gitlab` or `github` |
| `--debug` | `-d` | Show detailed debug information |
| `--fail-on-truncate` | - | Exit with error if diff is truncated |

## Scope Analysis Feature

mr-pilot automatically analyzes code changes to determine what requirements are addressed:

1. **Commits are fetched** from the MR and included in the prompt
2. **LLM analyzes** the diff to identify implemented features
3. **Output includes** `scope_analysis` object with:
   - `addressed`: List of requirements/features implemented
   - `not_addressed`: Requirements not covered
   - `summary`: Brief explanation of what changes implement

This works even without an input file - the LLM infers scope from commit messages and code patterns.

## Output Format

The review outputs structured JSON from the LLM:

```json
{
  "goal_status": "met|partially_met|unmet",
  "scope_analysis": {
    "addressed": ["feature 1", "feature 2"],
    "not_addressed": ["feature not found"],
    "summary": "Implementation covers..."
  },
  "errors": ["issue 1", "issue 2"],
  "remarks": "Overall assessment",
  "score": 88
}
```

The console displays a formatted report, and the comment (if posted) includes:
- Goal Status
- Quality Score
- Scope Analysis section
- Potential Issues
- Remarks

## Environment File Example

```bash
# GitLab Configuration
GITLAB_TOKEN=glpat-xxxx
GITLAB_API=https://git.geored.fr/api/v4
GITLAB_DEFAULT_PROJECT=RD_soft/simpliciti-frontend/geored-v3

# GitHub Configuration (if using GitHub PRs)
GITHUB_TOKEN=ghp_xxxx

# LLM Configuration (OpenRouter example)
OPENROUTER_API_KEY=sk-or-v1-xxxx
OPENROUTER_MODEL=google/gemini-3-flash-preview

# Optional: Increase default diff size
MAX_DIFF_CHARS=100000
```

## Troubleshooting

**"Authentication failed"**: Check your GITLAB_TOKEN or GITHUB_TOKEN is set correctly.

**"MR not found"**: Verify the MR URL/ID and ensure project path is correct.

**"Diff truncated"**: Use `--max-diff-chars` with a larger value or remove the limit.

**Network errors**: Ensure VPN/proxy is configured for self-hosted GitLab instances.

## See Also

- [CLI Reference](references/CLI-REFERENCE.md) - Detailed CLI options
- mr-pilot repository: https://github.com/javimosch/mr-pilot