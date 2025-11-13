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
   - `GITLAB_API`: Your GitLab API URL (default: https://git.geored.fr/api/v4)
   - `OPENROUTER_API_KEY`: Your OpenRouter API key
   - `OPENROUTER_MODEL`: LLM model to use (default: anthropic/claude-3.5-sonnet)

## Usage

### Using full MR URL:
```bash
node src/index.js https://git.geored.fr/RD_soft/simpliciti-frontend/geored-v3/-/merge_requests/1763
```

### Or with npm script:
```bash
npm start https://git.geored.fr/RD_soft/simpliciti-frontend/geored-v3/-/merge_requests/1763
```

## Output

The tool provides:
- Goal status (met/partially_met/unmet)
- List of potential issues
- Overall remarks
- Quality score (0-100)
