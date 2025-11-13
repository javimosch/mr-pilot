function buildPrompt({ title, description, sourceBranch, targetBranch, changedFiles, diffs, ticketScope, guidelines }) {
  let prompt = `You are a senior software code reviewer conducting a thorough merge request review.

**Merge Request Context:**
- Title: ${title}
- Description: ${description}
- Source Branch: ${sourceBranch}
- Target Branch: ${targetBranch}
- Files Changed: ${changedFiles}
`;

  if (ticketScope) {
    prompt += `
**Ticket/Requirement Specification:**
${ticketScope}

**IMPORTANT - Review Scope:**
ONLY review changes that are directly related to the ticket requirements above. 
This MR may contain additional commits from other tickets due to branch integration.
Ignore changes that are clearly unrelated to the stated requirements.
`;
  }

  if (guidelines) {
    prompt += `
**Project-Specific Guidelines & Conventions:**
The following are ESTABLISHED PROJECT RULES that you MUST ACCEPT as correct:

${guidelines}

**CRITICAL:** 
- These are NOT issues to report
- These conventions are INTENTIONAL and CORRECT for this project
- Do NOT include any of these in your "errors" list
- Do NOT penalize the score for following these conventions
- Examples of what NOT to flag:
  * If guidelines say "console logs auto-disabled in production" → Do NOT flag console.log statements
  * If guidelines say "VITE_ envs normalized" → Do NOT flag camelCase env variable access
  * If guidelines say "tests in separate pipeline" → Do NOT flag missing tests in MR
`;
  }

  // Check if diffs are truncated
  const isTruncated = diffs.includes('⚠️ [DIFF TRUNCATED:');

  prompt += `
**Your Task:**
Review the code changes below and provide a structured analysis covering:
1. Whether the implementation meets the stated goal/requirements${ticketScope ? ' (as defined in the specification above)' : ''}
2. Any potential bugs, errors, or implementation issues
3. Code quality concerns (if any)
4. An overall quality score from 0-100

**Critical Review Standards:**
You are conducting a THOROUGH code review. Be critical and detailed:
- Look for missing error handling, edge cases, security issues
- Check for code smells, redundancy, and maintainability issues
- Verify testing coverage and documentation
- Question assumptions and implementation choices
- Consider performance, scalability, and potential technical debt

**Scoring Guidelines (Be Conservative):**
- 90-100: Exceptional - production-ready, comprehensive testing, excellent practices, zero concerns
- 75-89: Good - solid implementation, minor improvements possible, good practices
- 60-74: Acceptable - works but has notable issues, some technical debt, needs improvements
- 40-59: Needs work - significant issues, missing tests/docs, questionable patterns
- 0-39: Poor - major flaws, incomplete implementation, security concerns

**Important Notes:**
- A score of 90+ should be RARE and only for truly exceptional code
- Most well-functioning code should score 70-85
- Always list ALL issues found, even minor ones
- If you see fewer than 3 issues in a large MR (>10 files), you're not being thorough enough

${isTruncated ? '⚠️ **Note:** The diff was truncated due to size. You are seeing only a partial view of the changes. Be more conservative in your scoring and explicitly mention incomplete review in remarks.\n' : ''}
**Important:** You must respond with ONLY valid JSON in this exact format:
{
  "goal_status": "met" | "partially_met" | "unmet",
  "errors": ["list of specific issues found"],
  "remarks": "brief overall assessment and key observations",
  "score": <number between 0-100>
}

**JSON Format Requirements:**
- Use plain quotes, NOT backticks in your JSON strings
- Do NOT escape curly braces { } in strings - they don't need escaping in JSON
- Only escape these characters in strings: " (quote), \ (backslash), / (forward slash)
- Example valid string: "function { return true }" not "function \{ return true \}"
- No markdown formatting inside JSON values

**Code Changes:**
${diffs}

Remember: Respond ONLY with the JSON object, no additional text.`;

  return prompt;
}

module.exports = { buildPrompt };
