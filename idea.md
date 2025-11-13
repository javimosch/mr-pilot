HUMAN:
Craft plan to create a nodejs script that retrieves diffs from a custom server gitlab MR (merge requests) and sends the diffs to an LLM (openrouter) for analysis. We also send the ticker changes/scope so the LLM answers if a code review (if goal is meet/unmeet and if there are potential implementation errors + global MR score)

AI:
Here’s a clear step-by-step plan to design and implement that Node.js script.
Goal: automatically retrieve diffs from a GitLab Merge Request (MR), send them to an LLM via OpenRouter, and get structured analysis (goal met/unmet, errors, score).

1. Architecture Overview

Flow:

Input: MR URL or ID

GitLab API: Retrieve MR metadata + changes (diffs).

Prompt builder: Format the MR scope/ticket description + diffs into a concise, LLM-friendly context.

LLM Call (OpenRouter API): Send prompt, get structured JSON reply.

Output: Display or store analysis result (console, Slack, or CI output).

2. Setup
Dependencies
npm init -y
npm install axios dotenv openai

Environment

.env

GITLAB_TOKEN=your_gitlab_token
GITLAB_API=https://gitlab.yourserver.com/api/v4
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet   # example

3. Core Modules Structure
scripts/
 ├── index.js                # entry point
 ├── gitlabClient.js         # fetch MR data and diffs
 ├── promptBuilder.js        # construct review prompt
 ├── openrouterClient.js     # send prompt to LLM
 └── outputFormatter.js      # format/display/save LLM output

4. Implementation Plan (Step-by-Step)
4.1 GitLab Client

Use the GitLab REST API.

Endpoints:

MR details: GET /projects/:id/merge_requests/:iid

MR changes: GET /projects/:id/merge_requests/:iid/changes

Tasks:

Accept MR URL or project/MR IDs.

Parse and fetch title, description, source_branch, target_branch.

Get changes[].diff and changes[].new_path.

4.2 Prompt Builder

The LLM needs:

Ticket / scope (goal description)

Code diffs (trimmed, grouped by file)

Expected output schema

Example:

function buildPrompt({ title, description, diffs }) {
  return `
You are a senior software reviewer.

Context:
Title: ${title}
Description: ${description}

Review the following changes and evaluate if the implementation meets the described goal, identify any potential issues, and give a global MR score (0–100).

Respond strictly in JSON with:
{
  "goal_status": "met" | "partially_met" | "unmet",
  "errors": [ "error1", "error2", ... ],
  "remarks": "short explanation",
  "score": number
}

Code Changes:
${diffs.slice(0, 5000)}  # limit to avoid token overflow
`;
}


You may chunk long diffs and summarize sequentially with multiple requests if needed.

4.3 OpenRouter Client
import axios from "axios";

export async function analyzeMR(prompt) {
  const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
    model: process.env.OPENROUTER_MODEL,
    messages: [
      { role: "system", content: "You are a senior code reviewer." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" }
  }, {
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
  return res.data.choices?.[0]?.message?.content;
}

4.4 Output Formatter

Parse JSON and display in a clean format:

export function printResult(json) {
  const result = JSON.parse(json);
  console.log("\n=== MR REVIEW REPORT ===");
  console.log(`Goal status: ${result.goal_status}`);
  console.log(`Score: ${result.score}`);
  if (result.errors.length) {
    console.log("Potential Issues:");
    result.errors.forEach(e => console.log(` - ${e}`));
  }
  console.log(`Remarks: ${result.remarks}`);
}

4.5 Orchestration (index.js)
import dotenv from "dotenv";
import { getMergeRequestDiffs } from "./gitlabClient.js";
import { buildPrompt } from "./promptBuilder.js";
import { analyzeMR } from "./openrouterClient.js";
import { printResult } from "./outputFormatter.js";

dotenv.config();

(async () => {
  const mrUrl = process.argv[2];
  if (!mrUrl) {
    console.error("Usage: node index.js <gitlab_mr_url>");
    process.exit(1);
  }

  const { title, description, diffs } = await getMergeRequestDiffs(mrUrl);
  const prompt = buildPrompt({ title, description, diffs });
  const response = await analyzeMR(prompt);
  printResult(response);
})();

5. Optional Enhancements
Feature	Description
Chunked diff summarization	Handle large MRs by summarizing per file and then combining summaries.
Caching	Store previous analyses to avoid repeated LLM calls.
CI/CD integration	Run script in pipeline, fail if score < threshold.
Slack/Email reports	Notify reviewers automatically with summary and score.
Fine-tuned prompt per repo	Customize scoring weights (performance, style, tests, etc.).
6. Example Output
{
  "goal_status": "partially_met",
  "errors": [
    "Missing error handling in file upload logic",
    "Test coverage not updated for new API endpoint"
  ],
  "remarks": "The implementation mostly achieves the intended goal but lacks robustness.",
  "score": 74
}
