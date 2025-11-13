require('dotenv').config();
const { getMergeRequestDiffs } = require('./gitlabClient');
const { buildPrompt } = require('./promptBuilder');
const { analyzeMR } = require('./openrouterClient');
const { printResult } = require('./outputFormatter');

async function main() {
  try {
    // Parse command line arguments
    const mrUrl = process.argv[2];

    if (!mrUrl) {
      console.error('Usage: node src/index.js <gitlab_mr_url>');
      console.error('Example: node src/index.js https://git.geored.fr/RD_soft/simpliciti-frontend/geored-v3/-/merge_requests/1763');
      process.exit(1);
    }

    console.log('GitLab MR Review Bot\n');

    // Step 1: Fetch MR data from GitLab
    const mrData = await getMergeRequestDiffs(mrUrl);
    console.log(`✓ Retrieved MR: "${mrData.title}"`);
    console.log(`  ${mrData.changedFiles} file(s) changed\n`);

    // Step 2: Build prompt for LLM
    const prompt = buildPrompt(mrData);

    // Step 3: Send to LLM for analysis
    const response = await analyzeMR(prompt);
    console.log('✓ Analysis complete\n');

    // Step 4: Parse and display results
    printResult(response);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
