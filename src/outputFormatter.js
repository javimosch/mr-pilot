function printResult(jsonString) {
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
    const result = JSON.parse(cleanJson);

    console.log('\n' + '='.repeat(50));
    console.log('         MR REVIEW REPORT');
    console.log('='.repeat(50));
    console.log();
    console.log(`Goal Status: ${result.goal_status.toUpperCase()}`);
    console.log(`Quality Score: ${result.score}/100`);
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

function formatCommentBody(result) {
  let comment = '## 🤖 AI Code Review\n\n';
  
  comment += `**Goal Status:** ${result.goal_status.toUpperCase()}\n`;
  comment += `**Quality Score:** ${result.score}/100\n\n`;

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
  comment += '*Generated automatically by GitLab MR Review Bot*';

  return comment;
}

module.exports = { printResult, formatCommentBody };
