require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getMergeRequestDiffs, postMRComment } = require('./gitlabClient');
const { buildPrompt } = require('./promptBuilder');
const { analyzeMR } = require('./openrouterClient');
const { printResult, formatCommentBody } = require('./outputFormatter');

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const mrUrlOrId = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-'));
    const shouldComment = args.includes('--comment') || args.includes('-c');
    
    // Find input file argument
    const inputFileIndex = args.findIndex(arg => arg === '--input-file' || arg === '-i');
    let inputFilePath = null;
    if (inputFileIndex !== -1 && args[inputFileIndex + 1]) {
      inputFilePath = args[inputFileIndex + 1];
    }

    // Find project argument
    const projectIndex = args.findIndex(arg => arg === '--project' || arg === '-p');
    let projectPath = null;
    if (projectIndex !== -1 && args[projectIndex + 1]) {
      projectPath = args[projectIndex + 1];
    }

    if (!mrUrlOrId) {
      console.error('Usage: node src/index.js <mr_url_or_id> [options]');
      console.error('');
      console.error('Options:');
      console.error('  --comment, -c                Post review as comment on the MR');
      console.error('  --input-file, -i <path>      Path to ticket/requirement specification file');
      console.error('  --project, -p <path>         GitLab project path (e.g., group/subgroup/project)');
      console.error('');
      console.error('Examples:');
      console.error('  # Using full MR URL');
      console.error('  node src/index.js https://git.geored.fr/.../merge_requests/1763');
      console.error('');
      console.error('  # Using MR ID with default project (set GITLAB_DEFAULT_PROJECT in .env)');
      console.error('  node src/index.js 1763');
      console.error('');
      console.error('  # Using MR ID with project argument');
      console.error('  node src/index.js 1763 --project RD_soft/simpliciti-frontend/geored-v3');
      console.error('');
      console.error('  # With input file and comment');
      console.error('  node src/index.js 1763 -i input.txt --comment');
      process.exit(1);
    }

    console.log('GitLab MR Review Bot\n');

    // Step 1: Read input file if provided
    let ticketScope = null;
    if (inputFilePath) {
      try {
        const resolvedPath = path.resolve(inputFilePath);
        ticketScope = fs.readFileSync(resolvedPath, 'utf-8');
        console.log(`✓ Loaded ticket specification from: ${inputFilePath}\n`);
      } catch (error) {
        throw new Error(`Failed to read input file '${inputFilePath}': ${error.message}`);
      }
    }

    // Step 2: Fetch MR data from GitLab
    const mrData = await getMergeRequestDiffs(mrUrlOrId, projectPath);
    console.log(`✓ Retrieved MR: "${mrData.title}"`);
    console.log(`  ${mrData.changedFiles} file(s) changed\n`);

    // Step 3: Build prompt for LLM
    const prompt = buildPrompt({ ...mrData, ticketScope });

    // Step 4: Send to LLM for analysis
    const response = await analyzeMR(prompt);
    console.log('✓ Analysis complete\n');

    // Step 5: Parse and display results
    const result = printResult(response);

    // Step 6: Post comment if requested
    if (shouldComment) {
      const commentBody = formatCommentBody(result);
      await postMRComment(mrUrlOrId, commentBody, projectPath);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
