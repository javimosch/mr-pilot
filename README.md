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

### Post review as comment on MR:
```bash
node src/index.js 1763 --comment
# or
node src/index.js 1763 -c
```

### Combine all options:
```bash
node src/index.js 1763 -p RD_soft/simpliciti-frontend/geored-v3 -i input.txt --comment
```

## Options

- `--comment`, `-c`: Post the review as a comment on the GitLab MR
- `--input-file <path>`, `-i <path>`: Path to a file containing ticket/requirement specification
- `--project <path>`, `-p <path>`: GitLab project path (e.g., group/subgroup/project)

## Input File Format

The input file should contain the ticket scope, requirements, or specification that the MR is supposed to implement. This helps the AI evaluate whether the code changes meet the stated goals.

Example `input.txt`:
```
Feature: Add user authentication
- Implement login form with email/password
- Add JWT token generation
- Include logout functionality
- Add session management
```

## Output

The tool provides:
- Goal status (met/partially_met/unmet)
- List of potential issues
- Overall remarks
- Quality score (0-100)

With `--comment` flag, this same output is posted as a formatted comment on the MR.
