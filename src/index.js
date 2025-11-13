require('dotenv').config();
const { getMergeRequestDiffs, postMRComment } = require('./gitlabClient');
const { buildPrompt } = require('./promptBuilder');
const { analyzeMR } = require('./openrouterClient');
const { printResult, formatCommentBody } = require('./outputFormatter');

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const mrUrl = args[0];
    const shouldComment = args.includes('--comment') || args.includes('-c');

    if (!mrUrl) {
      console.error('Usage: node src/index.js <gitlab_mr_url> [--comment|-c]');
      console.error('Example: node src/index.js https://git.geored.fr/RD_soft/simpliciti-frontend/geored-v3/-/merge_requests/1763');
      console.error('Example with comment: node src/index.js https://git.geored.fr/RD_soft/simpliciti-frontend/geored-v3/-/merge_requests/1763 --comment');
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
    const result = printResult(response);

    // Step 5: Post comment if requested
    if (shouldComment) {
      const commentBody = formatCommentBody(result);
      await postMRComment(mrUrl, commentBody);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
