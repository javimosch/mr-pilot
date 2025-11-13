const axios = require('axios');

// Cache token validation to avoid repeated API calls within a session
// Reset between different runs by clearing on module reload
let tokenValidated = false;
let lastValidatedToken = null;

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

    // Validate token has required scopes (only once per session per token)
    const currentToken = token.substring(0, 20); // Use prefix for cache key
    if (!tokenValidated || lastValidatedToken !== currentToken) {
      try {
        const userResponse = await axios.get(`${apiBase}/user`, { headers, timeout: 10000 });
        const scopes = userResponse.headers['x-oauth-scopes'];
        if (scopes && !scopes.includes('repo')) {
          throw new Error(
            'GITHUB_TOKEN is missing the required "repo" scope. Please create a new token with the "repo" scope at https://github.com/settings/tokens'
          );
        }
        tokenValidated = true;
        lastValidatedToken = currentToken;
      } catch (scopeError) {
        // Only continue if it's our custom scope error
        if (scopeError.message && scopeError.message.includes('repo')) {
          throw scopeError;
        }
        // For auth errors, throw them
        if (scopeError.response && (scopeError.response.status === 401 || scopeError.response.status === 403)) {
          throw new Error('Authentication failed. Check your GITHUB_TOKEN.');
        }
        // For other errors (network, timeout), throw them too
        throw scopeError;
      }
    }

    console.log(`Fetching PR ${prNumber} from ${owner}/${repo}...`);

    // Fetch PR metadata with retry logic
    let prResponse, filesResponse;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        prResponse = await axios.get(
          `${apiBase}/repos/${owner}/${repo}/pulls/${prNumber}`,
          { headers, timeout: 30000 }
        );
        break; // Success, exit retry loop
      } catch (error) {
        if (error.response?.status === 429) {
          const resetTime = error.response.headers['x-ratelimit-reset'];
          if (resetTime && attempt < maxRetries) {
            const waitTime = Math.max(0, parseInt(resetTime) * 1000 - Date.now());
            const waitSeconds = Math.ceil(waitTime / 1000);
            console.log(`⚠️  Rate limit exceeded. Waiting ${waitSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime + 1000));
            continue;
          }
        }
        throw error; // Re-throw if not rate limit or last attempt
      }
    }

    const pr = prResponse.data;

    // Fetch PR files (includes diffs) with retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        filesResponse = await axios.get(
          `${apiBase}/repos/${owner}/${repo}/pulls/${prNumber}/files`,
          { headers, timeout: 30000 }
        );
        break; // Success, exit retry loop
      } catch (error) {
        if (error.response?.status === 429) {
          const resetTime = error.response.headers['x-ratelimit-reset'];
          if (resetTime && attempt < maxRetries) {
            const waitTime = Math.max(0, parseInt(resetTime) * 1000 - Date.now());
            const waitSeconds = Math.ceil(waitTime / 1000);
            console.log(`⚠️  Rate limit exceeded. Waiting ${waitSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime + 1000));
            continue;
          }
        }
        throw error; // Re-throw if not rate limit or last attempt
      }
    }

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
      
      // Find the last complete file before MAX_DIFF_LENGTH
      const beforeLimit = diffsText.substring(0, MAX_DIFF_LENGTH);
      const lastFileMarker = beforeLimit.lastIndexOf('\n### File:');
      
      let truncatedDiff;
      if (lastFileMarker > 0) {
        // Truncate at the last complete file
        truncatedDiff = diffsText.substring(0, lastFileMarker);
      } else {
        // If no complete file fits, just use the limit
        truncatedDiff = beforeLimit;
      }
      
      // Count total and included files more accurately
      const totalFiles = (diffsText.match(/### File:/g) || []).length;
      const includedFiles = (truncatedDiff.match(/### File:/g) || []).length;
      truncatedFiles = totalFiles - includedFiles;

      diffsText =
        truncatedDiff +
        `\n\n⚠️ [DIFF TRUNCATED: ${truncatedFiles} files not shown due to size limit. Original: ${originalLength} chars, showing: ${truncatedDiff.length} chars]\n` +
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
        } else if (error.response.status === 429) {
          // Rate limit exceeded - retry after waiting
          const resetTime = error.response.headers['x-ratelimit-reset'];
          if (resetTime && !isLastAttempt) {
            const waitTime = Math.max(0, parseInt(resetTime) * 1000 - Date.now());
            const waitSeconds = Math.ceil(waitTime / 1000);
            console.log(`⚠️  Rate limit exceeded. Waiting ${waitSeconds} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime + 1000));
            continue;
          } else if (isLastAttempt) {
            throw new Error('GitHub API rate limit exceeded after retries. Please try again later.');
          }
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
