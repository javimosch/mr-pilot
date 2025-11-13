function printResult(jsonString) {
  try {
    // Try to extract JSON from markdown code blocks if present
    let cleanJson = jsonString.trim();
    
    // Remove markdown code blocks
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/```\n?/g, '');
    }

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

module.exports = { printResult };
