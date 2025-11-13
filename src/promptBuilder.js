function buildPrompt({ title, description, sourceBranch, targetBranch, changedFiles, diffs, ticketScope }) {
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
`;
  }

  prompt += `
**Your Task:**
Review the code changes below and provide a structured analysis covering:
1. Whether the implementation meets the stated goal/requirements${ticketScope ? ' (as defined in the specification above)' : ''}
2. Any potential bugs, errors, or implementation issues
3. Code quality concerns (if any)
4. An overall quality score from 0-100

**Important:** You must respond with ONLY valid JSON in this exact format:
{
  "goal_status": "met" | "partially_met" | "unmet",
  "errors": ["list of specific issues found"],
  "remarks": "brief overall assessment and key observations",
  "score": <number between 0-100>
}

**Code Changes:**
${diffs}

Remember: Respond ONLY with the JSON object, no additional text.`;

  return prompt;
}

module.exports = { buildPrompt };
