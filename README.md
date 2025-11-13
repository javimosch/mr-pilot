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
   - `GITLAB_API`: Your GitLab API URL (e.g., https://gitlab.com/api/v4)
   - `GITLAB_DEFAULT_PROJECT`: (Optional) Default project path for using MR ID only
   - `MAX_DIFF_CHARS`: (Optional) Maximum characters for diffs (default: 50000)
   - `LLM_PROVIDER`: LLM provider to use (openrouter, openai, ollama, azure)
   - `LLM_API_KEY`: Your LLM API key (not needed for Ollama)
   - `LLM_MODEL`: Model to use (e.g., openai/gpt-oss-120b:exacto, gpt-4o, llama3.1:8b)

## Usage

### Using full MR URL:
```bash
node src/index.js https://gitlab.com/MyOrg/MyGroup/MyProject/-/merge_requests/1763
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

## LLM Provider Configuration

The tool supports multiple LLM providers. Configure via environment variables:

### OpenRouter (default)
```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-...
LLM_MODEL=openai/gpt-oss-120b:exacto
```

### OpenAI
```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

### Ollama (local)
```env
LLM_PROVIDER=ollama
LLM_MODEL=llama3.1:8b
# LLM_API_URL=http://localhost:11434/v1/chat/completions  # default
```

### Azure OpenAI
```env
LLM_PROVIDER=azure
LLM_API_KEY=your_azure_key
LLM_MODEL=gpt-4
LLM_API_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-02-15-preview
```

### Custom OpenAI-compatible API
```env
LLM_PROVIDER=openai
LLM_API_KEY=your_key
LLM_MODEL=your-model
LLM_API_URL=https://your-custom-endpoint.com/v1/chat/completions
```

**Note:** Legacy `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` variables are still supported for backward compatibility.

## Output

The tool provides:
- Goal status (met/partially_met/unmet)
- List of potential issues
- Overall remarks
- Quality score (0-100)

With `--comment` flag, this same output is posted as a formatted comment on the MR.

## Error Handling & Reliability

The tool includes robust error handling:

### Automatic Retries
- **LLM requests**: Up to 3 attempts with 2-minute timeout per attempt
- **GitLab API**: Up to 3 attempts with 30-second timeout per attempt
- **Rate limits**: Exponential backoff (2s, 4s, 8s delays)
- **Server errors (5xx)**: Automatic retry with 3-second delay

### Timeout Protection
If requests hang, the tool will:
1. Wait for the configured timeout (30s for GitLab, 2min for LLM)
2. Retry automatically (up to 3 times)
3. Show clear error message if all attempts fail

### What gets retried:
- ✅ Timeouts
- ✅ Network errors
- ✅ Server errors (500, 502, 503, etc.)
- ✅ Rate limits (429)
- ❌ Authentication errors (401, 403)
- ❌ Bad requests (400)
- ❌ Not found (404)
