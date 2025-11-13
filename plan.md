# GitLab MR Review Automation - POC Plan

## Objective
Build a Node.js script that automatically retrieves diffs from a GitLab Merge Request and sends them to an LLM (via OpenRouter) for code review analysis.

## Output Goal
The LLM provides structured feedback on:
- Whether the implementation meets the ticket/scope goals
- Potential implementation errors or issues
- Overall MR quality score (0-100)

---

## Architecture

### Flow
```
MR URL → GitLab API → Fetch MR metadata + diffs → Build prompt → 
OpenRouter API (LLM) → Parse JSON response → Display results
```

### Components
1. **GitLab Client**: Fetch MR details and code diffs
2. **Prompt Builder**: Format MR context and diffs into LLM-friendly prompt
3. **OpenRouter Client**: Send prompt to LLM and receive analysis
4. **Output Formatter**: Parse and display results

---

## Project Setup

### Dependencies
```bash
npm init -y
npm install axios dotenv
```

### Environment Variables (.env)
```env
GITLAB_TOKEN=your_gitlab_personal_access_token
GITLAB_API=https://gitlab.yourserver.com/api/v4
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

### Project Structure
```
gitlab-mr-review/
├── .env
├── .gitignore
├── package.json
├── src/
│   ├── index.js              # Entry point & orchestration
│   ├── gitlabClient.js       # GitLab API interactions
│   ├── promptBuilder.js      # Construct review prompt
│   ├── openrouterClient.js   # LLM API client
│   └── outputFormatter.js    # Format and display results
```

---

## Implementation Steps

### 1. GitLab Client (gitlabClient.js)

**API Endpoints:**
- MR details: `GET /projects/:id/merge_requests/:iid`
- MR changes: `GET /projects/:id/merge_requests/:iid/changes`

**Tasks:**
- Parse MR URL to extract project ID and MR IID
- Fetch MR metadata (title, description, source/target branches)
- Retrieve code diffs for all changed files
- Return structured data: `{ title, description, diffs }`

**Key Data:**
- `changes[].diff`: Raw diff content
- `changes[].new_path`: File path
- `changes[].old_path`: Original file path (for renames)

---

### 2. Prompt Builder (promptBuilder.js)

**Purpose:** Create a structured prompt that helps the LLM understand context and expected output.

**Prompt Structure:**
```
Role: Senior code reviewer

Context:
- MR Title: [title]
- Description: [description]
- Changed Files: [list]

Task: Review the following diffs and evaluate:
1. Does the implementation meet the described goal?
2. Are there potential implementation errors?
3. Overall quality score (0-100)

Expected JSON Response:
{
  "goal_status": "met" | "partially_met" | "unmet",
  "errors": ["error1", "error2"],
  "remarks": "brief explanation",
  "score": number
}

Code Diffs:
[formatted diffs]
```

**Considerations:**
- Limit diff size to avoid token overflow (~5000 chars for POC)
- Format diffs for readability (file headers, truncate if needed)

---

### 3. OpenRouter Client (openrouterClient.js)

**API Endpoint:** `https://openrouter.ai/api/v1/chat/completions`

**Request Format:**
```javascript
{
  model: process.env.OPENROUTER_MODEL,
  messages: [
    { role: "system", content: "You are a senior code reviewer." },
    { role: "user", content: prompt }
  ]
}
```

**Headers:**
```javascript
{
  "Authorization": "Bearer ${OPENROUTER_API_KEY}",
  "Content-Type": "application/json"
}
```

**Response:** Extract LLM's text response and parse as JSON

---

### 4. Output Formatter (outputFormatter.js)

**Tasks:**
- Parse JSON response from LLM
- Display in clean, readable format
- Handle parsing errors gracefully

**Output Format:**
```
=== MR REVIEW REPORT ===
Goal Status: [met/partially_met/unmet]
Score: [0-100]

Potential Issues:
- [error 1]
- [error 2]

Remarks: [brief explanation]
```

---

### 5. Main Orchestration (index.js)

**Flow:**
1. Load environment variables
2. Parse command-line arguments (MR URL)
3. Call GitLab client to fetch MR data
4. Build prompt from MR data
5. Send prompt to OpenRouter
6. Format and display results
7. Handle errors at each step

**Usage:**
```bash
node src/index.js <gitlab_mr_url>
```

---

## Error Handling

### POC Error Scenarios:
- Invalid/missing MR URL
- GitLab API authentication failure
- MR not found (404)
- OpenRouter API errors
- Invalid JSON response from LLM
- Network timeouts

**Approach:** Basic try-catch blocks with descriptive error messages

---

## Testing Strategy

### Manual Testing:
1. Test with a small MR (1-2 files changed)
2. Test with a medium MR (5-10 files)
3. Test with invalid MR URL
4. Test with missing environment variables
5. Verify JSON parsing works correctly

---

## Success Criteria

### POC is successful if:
- ✅ Script successfully fetches MR data from GitLab API
- ✅ Diffs are properly formatted and sent to LLM
- ✅ LLM returns structured JSON analysis
- ✅ Results are displayed in readable format
- ✅ Basic error handling works
- ✅ Can review a real MR end-to-end

---

## Limitations (POC Scope)

### Out of Scope:
- Large MR handling (>5000 chars diff)
- Diff chunking/summarization
- Caching mechanisms
- CI/CD integration
- Slack/email notifications
- Custom prompts per repository
- Retry logic for API failures
- Rate limiting handling

### POC Constraints:
- Single LLM call per MR (no chunking)
- Basic error messages (no detailed logging)
- Command-line only (no web interface)
- No result persistence (display only)

---

## Next Steps After POC

1. Review POC results and gather feedback
2. Evaluate LLM response quality
3. Identify improvements needed
4. Plan production-ready features
5. Consider chunking strategy for large MRs
6. Add comprehensive error handling
7. Implement CI/CD integration

---

## Estimated Timeline

- Environment setup: 30 minutes
- GitLab client: 2 hours
- Prompt builder: 1 hour
- OpenRouter client: 1 hour
- Output formatter: 30 minutes
- Main orchestration: 1 hour
- Testing & debugging: 2 hours

**Total: ~8 hours**
