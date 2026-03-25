function printResult(jsonString, acceptanceCriteria = null) {
  try {
    // Try to extract JSON from markdown code blocks if present
    let cleanJson = jsonString.trim();
    
    // Remove markdown code blocks more robustly
    if (cleanJson.startsWith('```json')) {
      // Find the last closing ``` to handle code blocks within JSON content
      const firstNewline = cleanJson.indexOf('\n');
      const lastTripleBacktick = cleanJson.lastIndexOf('```');
      if (firstNewline !== -1 && lastTripleBacktick > firstNewline) {
        cleanJson = cleanJson.substring(firstNewline + 1, lastTripleBacktick);
      } else {
        cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      }
    } else if (cleanJson.startsWith('```')) {
      const firstNewline = cleanJson.indexOf('\n');
      const lastTripleBacktick = cleanJson.lastIndexOf('```');
      if (firstNewline !== -1 && lastTripleBacktick > firstNewline) {
        cleanJson = cleanJson.substring(firstNewline + 1, lastTripleBacktick);
      } else {
        cleanJson = cleanJson.replace(/```\n?/g, '');
      }
    }

    cleanJson = cleanJson.trim();
    
    // Fix common LLM JSON formatting issues
    // 1. Remove invalid escape sequences like \{ \} \[ \] but keep valid ones like \" \\
    cleanJson = cleanJson.replace(/\\([{}[\]])/g, '$1');
    
    // 2. Fix unescaped newlines within strings (between quotes)
    // This is complex, so we'll try to parse and if it fails, show helpful error
    
    let result;
    try {
      result = JSON.parse(cleanJson);
    } catch (firstError) {
      // Try to fix unescaped newlines in strings
      // Split by quotes and fix newlines only in string content (odd-indexed parts)
      const parts = cleanJson.split('"');
      for (let i = 1; i < parts.length; i += 2) {
        // This is string content - escape newlines
        parts[i] = parts[i].replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      }
      cleanJson = parts.join('"');
      result = JSON.parse(cleanJson);
    }

    console.log('\n' + '='.repeat(50));
    console.log('         MR REVIEW REPORT');
    console.log('='.repeat(50));
    console.log();
    console.log(`Goal Status: ${result.goal_status.toUpperCase()}`);
    console.log(`Quality Score: ${result.score}/100`);

    if (result.scope_analysis) {
      console.log();
      console.log('📋 Scope Analysis:');
      if (result.scope_analysis.addressed && result.scope_analysis.addressed.length > 0) {
        console.log('   Addressed:');
        result.scope_analysis.addressed.forEach(item => console.log(`   ✓ ${item}`));
      }
      if (result.scope_analysis.not_addressed && result.scope_analysis.not_addressed.length > 0) {
        console.log('   Not Addressed:');
        result.scope_analysis.not_addressed.forEach(item => console.log(`   ✗ ${item}`));
      }
      if (result.scope_analysis.summary) {
        console.log(`   Summary: ${result.scope_analysis.summary}`);
      }
    }

    if (acceptanceCriteria) {
      console.log(`Acceptance Criteria: ${acceptanceCriteria}`);
    }

    console.log();

    if (result.errors && result.errors.length > 0) {
      console.log('⚠️  Potential Issues:');
      result.errors.forEach((error, idx) => {
        console.log(`   ${idx + 1}. ${error}`);
      });
      console.log();
    } else {
      console.log('✅ No issues found');
      console.log();
    }

    console.log('📝 Remarks:');
    console.log(`   ${result.remarks}`);
    console.log();
    console.log('='.repeat(50));

    return result;

  } catch (error) {
    console.error('\n❌ Failed to parse LLM response as JSON');
    console.error('Raw response:');
    console.error(jsonString);
    throw new Error(`JSON parsing failed: ${error.message}`);
  }
}

function formatCommentBody(result, acceptanceCriteria = null) {
  let comment = '## 🤖 AI Code Review\n\n';
  
  comment += `**Goal Status:** ${result.goal_status.toUpperCase()}\n`;
  comment += `**Quality Score:** ${result.score}/100\n`;

  if (result.scope_analysis) {
    comment += '\n### 📋 Scope Analysis\n\n';
    if (result.scope_analysis.addressed && result.scope_analysis.addressed.length > 0) {
      comment += '**Addressed:**\n';
      result.scope_analysis.addressed.forEach(item => comment += `- ✓ ${item}\n`);
      comment += '\n';
    }
    if (result.scope_analysis.not_addressed && result.scope_analysis.not_addressed.length > 0) {
      comment += '**Not Addressed:**\n';
      result.scope_analysis.not_addressed.forEach(item => comment += `- ✗ ${item}\n`);
      comment += '\n';
    }
    if (result.scope_analysis.summary) {
      comment += `**Summary:** ${result.scope_analysis.summary}\n\n`;
    }
  }
  
  if (acceptanceCriteria) {
    comment += `**Acceptance Criteria:** ${acceptanceCriteria}\n`;
  }
  
  comment += '\n';

  if (result.errors && result.errors.length > 0) {
    comment += '### ⚠️ Potential Issues\n\n';
    result.errors.forEach((error, idx) => {
      comment += `${idx + 1}. ${error}\n`;
    });
    comment += '\n';
  } else {
    comment += '### ✅ No issues found\n\n';
  }

  comment += '### 📝 Remarks\n\n';
  comment += `${result.remarks}\n\n`;
  comment += '---\n';
  comment += '*Generated automatically by AI Code Review Bot*';

  return comment;
}


module.exports = { printResult, formatCommentBody };
