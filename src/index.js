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
    const debugMode = args.includes('--debug') || args.includes('-d');
    const bailOnTruncate = args.includes('--fail-on-truncate') || args.includes('--bail-on-truncate');
    
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

    // Find max-diff-chars argument
    const maxDiffCharsIndex = args.findIndex(arg => arg === '--max-diff-chars' || arg === '-m');
    let maxDiffChars = null;
    if (maxDiffCharsIndex !== -1 && args[maxDiffCharsIndex + 1]) {
      maxDiffChars = parseInt(args[maxDiffCharsIndex + 1]);
      if (isNaN(maxDiffChars) || maxDiffChars < 1000) {
        throw new Error('--max-diff-chars must be a number >= 1000');
      }
    }

    if (!mrUrlOrId) {
      console.error('Usage: node src/index.js <mr_url_or_id> [options]');
      console.error('');
      console.error('Options:');
      console.error('  --comment, -c                    Post review as comment on the MR');
      console.error('  --input-file, -i <path>          Path to ticket/requirement specification file');
      console.error('  --project, -p <path>             GitLab project path (e.g., group/subgroup/project)');
      console.error('  --max-diff-chars, -m <number>    Maximum characters for diffs (default: 50000)');
      console.error('  --fail-on-truncate               Exit with error if diff is truncated (no LLM call)');
      console.error('  --debug, -d                      Show detailed debug information');
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
      console.error('');
      console.error('  # Debug mode to see prompt sent to LLM');
      console.error('  node src/index.js 1763 -i input.txt --debug');
      console.error('');
      console.error('  # Increase diff size limit for large MRs');
      console.error('  node src/index.js 1763 --max-diff-chars 100000');
      console.error('');
      console.error('  # Exit if diff is truncated (useful in CI/CD)');
      console.error('  node src/index.js 1763 --fail-on-truncate');
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
        
        if (debugMode) {
          console.log('📋 DEBUG - Ticket Specification:');
          console.log('─'.repeat(80));
          console.log(ticketScope);
          console.log('─'.repeat(80));
          console.log();
        }
      } catch (error) {
        throw new Error(`Failed to read input file '${inputFilePath}': ${error.message}`);
      }
    }

    // Step 2: Fetch MR data from GitLab
    const mrData = await getMergeRequestDiffs(mrUrlOrId, projectPath, maxDiffChars);
    console.log(`✓ Retrieved MR: "${mrData.title}"`);
    console.log(`  ${mrData.changedFiles} file(s) changed\n`);

    // Show diff stats
    if (mrData.diffStats.wasTruncated) {
      console.log('⚠️  DIFF TRUNCATED');
      console.log(`   Original size: ${mrData.diffStats.originalLength.toLocaleString()} chars`);
      console.log(`   Showing: ${mrData.diffStats.truncatedLength.toLocaleString()} chars`);
      console.log(`   Files hidden: ${mrData.diffStats.truncatedFiles}`);
      console.log(`   💡 For complete review, use: --max-diff-chars ${mrData.diffStats.recommendedMaxChars}`);
      console.log();
      
      if (bailOnTruncate) {
        console.error('❌ Exiting: diff is truncated (--fail-on-truncate enabled)');
        console.error('   Run with the recommended --max-diff-chars to review all changes.');
        process.exit(1);
      }
    } else {
      console.log(`✓ Full diff loaded (${mrData.diffStats.originalLength.toLocaleString()} chars)\n`);
    }

    if (debugMode) {
      console.log('📊 DEBUG - MR Metadata:');
      console.log('─'.repeat(80));
      console.log(`Title: ${mrData.title}`);
      console.log(`Description: ${mrData.description}`);
      console.log(`Source Branch: ${mrData.sourceBranch}`);
      console.log(`Target Branch: ${mrData.targetBranch}`);
      console.log(`Changed Files: ${mrData.changedFiles}`);
      console.log('─'.repeat(80));
      console.log();
    }

    // Step 3: Build prompt for LLM
    const prompt = buildPrompt({ ...mrData, ticketScope });

    if (debugMode) {
      console.log('🤖 DEBUG - Full Prompt Sent to LLM:');
      console.log('─'.repeat(80));
      console.log(prompt);
      console.log('─'.repeat(80));
      console.log();
      console.log(`📏 Prompt length: ${prompt.length} characters`);
      console.log(`📏 Ticket scope: ${ticketScope ? ticketScope.length : 0} characters`);
      console.log(`📏 Diffs: ${mrData.diffs.length} characters`);
      console.log();
    }

    // Step 4: Send to LLM for analysis
    const response = await analyzeMR(prompt);
    console.log('✓ Analysis complete\n');

    if (debugMode) {
      console.log('💬 DEBUG - Raw LLM Response:');
      console.log('─'.repeat(80));
      console.log(response);
      console.log('─'.repeat(80));
      console.log();
    }

    // Step 5: Parse and display results
    const result = printResult(response);

    // Step 6: Post comment if requested
    if (shouldComment) {
      const commentBody = formatCommentBody(result);
      
      if (debugMode) {
        console.log('\n💬 DEBUG - Comment to be posted:');
        console.log('─'.repeat(80));
        console.log(commentBody);
        console.log('─'.repeat(80));
        console.log();
      }
      
      await postMRComment(mrUrlOrId, commentBody, projectPath);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
