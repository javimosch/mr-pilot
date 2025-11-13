const axios = require('axios');

function parsePRUrl(input, projectArg = null) {
  if (!input) {
    throw new Error('PR URL or number is required');
  }

  // Check if it's a full URL
  const urlPattern = /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
  const urlMatch = input.match(urlPattern);

  if (urlMatch) {
    // Full URL provided
    const [, owner, repo, prNumber] = urlMatch;
    
    return {
      owner,
      repo,
      prNumber,
      apiBase: 'https://api.github.com'
    };
  }

  // Check if it's just a number (PR number)
  if (/^\d+$/.test(input)) {
    const prNumber = input;

    // Try to get repo from argument or environment
    const repoPath = projectArg || process.env.GITHUB_DEFAULT_REPO;

    if (!repoPath) {
      throw new Error(
        'PR number provided without repository. Use --project flag or set GITHUB_DEFAULT_REPO in .env'
      );
    }

    // Parse owner/repo format
    const repoMatch = repoPath.match(/^([^\/]+)\/([^\/]+)$/);
    if (!repoMatch) {
      throw new Error(
        'Invalid repository format. Expected: owner/repo'
      );
    }

    const [, owner, repo] = repoMatch;

    return {
      owner,
      repo,
      prNumber,
      apiBase: 'https://api.github.com'
    };
  }

  throw new Error(
    'Invalid input format. Expected: GitHub PR URL, PR number (with --project or GITHUB_DEFAULT_REPO)'
  );
}

async function getDiffs(prUrl, projectArg = null, maxDiffChars = null) {
  try {
    const { apiBase, owner, repo, prNumber } = parsePRUrl(prUrl, projectArg);

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is not set');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    console.log(`Fetching PR ${prNumber} from ${owner}/${repo}...`);

    // Fetch PR metadata
    const prResponse = await axios.get(
      `${apiBase}/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers, timeout: 30000 }
    );

    const pr = prResponse.data;

    // Fetch PR files (includes diffs)
    const filesResponse = await axios.get(
      `${apiBase}/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      { headers, timeout: 30000 }
    );

    const files = filesResponse.data;

    // Format diffs
    let diffsText = '';
    let truncatedFiles = 0;

    if (files && files.length > 0) {
      diffsText = files
        .map((file) => {
          const filePath = file.filename;
          return `\n### File: ${filePath}\n${file.patch || '(Binary or no changes)'}`;
        })
        .join('\n');
    }

    const originalLength = diffsText.length;
    const MAX_DIFF_LENGTH = maxDiffChars || parseInt(process.env.MAX_DIFF_CHARS) || 50000;

    let wasTruncated = false;
    if (diffsText.length > MAX_DIFF_LENGTH) {
      wasTruncated = true;
      // Count how many files we're losing
      truncatedFiles =
        (diffsText.match(/### File:/g) || []).length -
        (diffsText.substring(0, MAX_DIFF_LENGTH).match(/### File:/g) || []).length;

      diffsText =
        diffsText.substring(0, MAX_DIFF_LENGTH) +
        `\n\n⚠️ [DIFF TRUNCATED: ${truncatedFiles} files not shown due to size limit. Original: ${originalLength} chars, showing: ${MAX_DIFF_LENGTH} chars]\n` +
        `💡 To review all changes, use: --max-diff-chars ${originalLength + 1000}`;
    }

    return {
      title: pr.title,
      description: pr.body || 'No description provided',
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      changedFiles: files.length,
      diffs: diffsText,
      diffStats: {
        originalLength,
        truncatedLength: wasTruncated ? MAX_DIFF_LENGTH : originalLength,
        wasTruncated,
        truncatedFiles,
        recommendedMaxChars: originalLength + 1000
      }
    };
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        throw new Error(
          'PR not found. Check the URL and ensure you have access to this repository.'
        );
      } else if (error.response.status === 401) {
        throw new Error('Authentication failed. Check your GITHUB_TOKEN.');
      } else {
        throw new Error(
          `GitHub API error: ${error.response.status} - ${error.response.statusText}`
        );
      }
    }
    throw error;
  }
}

async function postComment(prUrl, commentBody, projectArg = null) {
  const maxRetries = 3;
  const timeout = 30000; // 30 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { apiBase, owner, repo, prNumber } = parsePRUrl(prUrl, projectArg);

      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        throw new Error('GITHUB_TOKEN environment variable is not set');
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      };

      if (attempt === 1) {
        console.log('Posting comment to PR...');
      } else {
        console.log(`Retrying... (attempt ${attempt}/${maxRetries})`);
      }

      await axios.post(
        `${apiBase}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        { body: commentBody },
        {
          headers,
          timeout: timeout
        }
      );

      console.log('✓ Comment posted successfully\n');
      return; // Success, exit function
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      // Check if it's a timeout or network error
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        if (isLastAttempt) {
          throw new Error(
            `Failed to post comment after ${maxRetries} attempts: Request timeout`
          );
        }
        console.log(`⚠️  Request timed out, retrying in 2 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      // Check HTTP errors
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('PR not found. Cannot post comment.');
        } else if (
          error.response.status === 401 ||
          error.response.status === 403
        ) {
          throw new Error(
            'Authentication failed or insufficient permissions to post comments.'
          );
        } else if (error.response.status >= 500) {
          // Server error - retry
          if (isLastAttempt) {
            throw new Error(
              `GitHub server error after ${maxRetries} attempts: ${error.response.status} - ${error.response.statusText}`
            );
          }
          console.log(
            `⚠️  Server error (${error.response.status}), retrying in 2 seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        } else {
          throw new Error(
            `GitHub API error: ${error.response.status} - ${error.response.statusText}`
          );
        }
      }

      // Unknown error
      if (isLastAttempt) {
        throw error;
      }
      console.log(`⚠️  Error: ${error.message}, retrying in 2 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

module.exports = { getDiffs, postComment };
