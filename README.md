# GitLab MR Review Bot

Automated code review tool that analyzes GitLab Merge Requests using AI.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Fill in your credentials in `.env`:
   - `GITLAB_TOKEN`: Your GitLab personal access token (with `api` scope)
   - `GITLAB_API`: Your GitLab API URL (e.g., https://git.geored.fr/api/v4)
   - `GITLAB_DEFAULT_PROJECT`: (Optional) Default project path for using MR ID only
   - `MAX_DIFF_CHARS`: (Optional) Maximum characters for diffs (default: 50000)
   - `OPENROUTER_API_KEY`: Your OpenRouter API key
   - `OPENROUTER_MODEL`: LLM model to use (default: anthropic/claude-3.5-sonnet)

## Usage

### Using full MR URL:
```bash
node src/index.js https://git.geored.fr/RD_soft/simpliciti-frontend/geored-v3/-/merge_requests/1763
```

### Using MR ID with default project (set in .env):
```bash
# Set GITLAB_DEFAULT_PROJECT=RD_soft/simpliciti-frontend/geored-v3 in .env
node src/index.js 1763
```

### Using MR ID with project argument:
```bash
node src/index.js 1763 --project RD_soft/simpliciti-frontend/geored-v3
```

Or using short flag:
```bash
node src/index.js 1763 -p RD_soft/simpliciti-frontend/geored-v3
```

### With ticket specification file:
```bash
node src/index.js 1763 --input-file input.txt
# or
node src/index.js 1763 -i input.txt
```

### With project guidelines (reduces false positives):
```bash
node src/index.js 1763 -i input.txt --guidelines-file guidelines.txt
# or
node src/index.js 1763 -i input.txt -g guidelines.txt
```

### Post review as comment on MR:
```bash
node src/index.js 1763 --comment
# or
node src/index.js 1763 -c
```

### Debug mode (see what's sent to LLM):
```bash
node src/index.js 1763 -i input.txt --debug
# or
node src/index.js 1763 -i input.txt -d
```

### Increase diff size limit for large MRs:
```bash
# First run shows: "For complete review, use: --max-diff-chars 75000"
node src/index.js 1763

# Then run with recommended size
node src/index.js 1763 --max-diff-chars 75000
# or
node src/index.js 1763 -m 75000
```

### Combine all options:
```bash
node src/index.js 1763 -p RD_soft/simpliciti-frontend/geored-v3 -i input.txt -m 100000 --comment --debug
```

## Options

- `--comment`, `-c`: Post the review as a comment on the GitLab MR
- `--input-file <path>`, `-i <path>`: Path to a file containing ticket/requirement specification
- `--guidelines-file <path>`, `-g <path>`: Path to project guidelines file (helps reduce false positives)
- `--project <path>`, `-p <path>`: GitLab project path (e.g., group/subgroup/project)
- `--max-diff-chars <number>`, `-m <number>`: Maximum characters for diffs (overrides MAX_DIFF_CHARS in .env)
- `--fail-on-truncate`: Exit with error if diff is truncated (useful for CI/CD to enforce complete reviews)
- `--debug`, `-d`: Show detailed debug information (prompt sent to LLM, raw response, etc.)

## Diff Size Management

Large MRs may have their diffs truncated to fit within token limits. The tool helps you handle this:

1. **First run**: Shows if truncation occurred and recommends the exact size needed
   ```
   ⚠️  DIFF TRUNCATED
      Original size: 72,580 chars
      Showing: 50,000 chars
      Files hidden: 16
      💡 For complete review, use: --max-diff-chars 73580
   ```

2. **Re-run with recommended size**: Get a complete review
   ```bash
   node src/index.js 1763 --max-diff-chars 73580
   ```

3. **Set default in .env** (optional): Avoid specifying each time
   ```env
   MAX_DIFF_CHARS=100000
   ```

4. **Fail on truncation** (CI/CD): Exit with error code 1 if diff is incomplete
   ```bash
   # Useful in CI/CD pipelines to ensure reviews are complete
   node src/index.js 1763 --fail-on-truncate
   
   # Output when truncated:
   # ❌ Exiting: diff is truncated (--fail-on-truncate enabled)
   #    Run with the recommended --max-diff-chars to review all changes.
   # Exit code: 1
   ```

## Debug Mode

When using `--debug`, the tool will display:
- 📋 Full ticket specification content
- 📊 MR metadata (title, description, branches, file count)
- 🤖 Complete prompt sent to the LLM
- 📏 Character counts for each section
- 💬 Raw LLM response before parsing
- 💬 Comment body that will be posted (if using --comment)

This helps you understand what context the AI is working with and verify the quality of the analysis.

## Input File Format

The input file should contain the ticket scope, requirements, or specification that the MR is supposed to implement. This helps the AI evaluate whether the code changes meet the stated goals.

**Important:** When an input file is provided, the AI will ONLY review changes related to those requirements. This helps ignore unrelated commits that may be present due to branch merges.

Example `input.txt`:
```
Feature: Add user authentication
- Implement login form with email/password
- Add JWT token generation
- Include logout functionality
- Add session management
```

## Guidelines File Format

The guidelines file helps reduce false positives by informing the AI about project-specific conventions and configurations.

Example `guidelines.txt`:
```
1. console logs (any type) are automatically disabled in production.
2. VITE_ envs are normalized so it can be specified in camelCase (works out of the box)
3. Unit tests are handled by a separate CI pipeline, not required in every MR
4. TypeScript strict mode is not enabled project-wide
```

When provided, the AI will NOT flag these as issues, reducing noise in the review.

## Output

The tool provides:
- Goal status (met/partially_met/unmet)
- List of potential issues
- Overall remarks
- Quality score (0-100)

With `--comment` flag, this same output is posted as a formatted comment on the MR.
