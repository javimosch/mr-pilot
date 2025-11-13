const axios = require('axios');

function parseMRUrl(input, projectArg = null) {
  if (!input) {
    throw new Error('MR URL or ID is required');
  }

  // Check if it's a full URL
  const urlPattern = /https?:\/\/([^\/]+)\/(.+?)\/-\/merge_requests\/(\d+)/;
  const urlMatch = input.match(urlPattern);

  if (urlMatch) {
    // Full URL provided
    const [, domain, projectPath, mrIid] = urlMatch;
    const projectId = encodeURIComponent(projectPath);

    return {
      domain,
      projectId,
      mrIid,
      apiBase: `https://${domain}/api/v4`
    };
  }

  // Check if it's just a number (MR ID)
  if (/^\d+$/.test(input)) {
    const mrIid = input;
    
    // Try to get project from argument or environment
    const projectPath = projectArg || process.env.GITLAB_DEFAULT_PROJECT;
    
    if (!projectPath) {
      throw new Error('MR ID provided without project path. Use --project flag or set GITLAB_DEFAULT_PROJECT in .env');
    }

    // Get domain from GITLAB_API env variable
    const gitlabApi = process.env.GITLAB_API;
    if (!gitlabApi) {
      throw new Error('GITLAB_API environment variable is not set');
    }

    // Extract domain from API URL (e.g., https://git.geored.fr/api/v4 -> git.geored.fr)
    const apiUrlMatch = gitlabApi.match(/https?:\/\/([^\/]+)/);
    if (!apiUrlMatch) {
      throw new Error('Invalid GITLAB_API format in environment');
    }

    const domain = apiUrlMatch[1];
    const projectId = encodeURIComponent(projectPath);

    return {
      domain,
      projectId,
      mrIid,
      apiBase: gitlabApi
    };
  }

  throw new Error('Invalid input format. Expected: MR URL, MR ID (with --project or GITLAB_DEFAULT_PROJECT), or MR ID alone if GITLAB_DEFAULT_PROJECT is set');
}

async function getMergeRequestDiffs(mrUrl, projectArg = null, maxDiffChars = null) {
  try {
    const { apiBase, projectId, mrIid } = parseMRUrl(mrUrl, projectArg);
    
    const token = process.env.GITLAB_TOKEN;
    if (!token) {
      throw new Error('GITLAB_TOKEN environment variable is not set');
    }

    const headers = {
      'PRIVATE-TOKEN': token
    };

    console.log(`Fetching MR ${mrIid} from project ${decodeURIComponent(projectId)}...`);

    // Fetch MR changes (includes metadata + diffs)
    const response = await axios.get(
      `${apiBase}/projects/${projectId}/merge_requests/${mrIid}/changes`,
      { headers }
    );

    const mr = response.data;
    
    // Format diffs
    let diffsText = '';
    let truncatedFiles = 0;
    
    if (mr.changes && mr.changes.length > 0) {
      diffsText = mr.changes.map(change => {
        const filePath = change.new_path || change.old_path;
        return `\n### File: ${filePath}\n${change.diff}`;
      }).join('\n');
    }

    const originalLength = diffsText.length;
    const MAX_DIFF_LENGTH = maxDiffChars || parseInt(process.env.MAX_DIFF_CHARS) || 50000;
    
    let wasTruncated = false;
    if (diffsText.length > MAX_DIFF_LENGTH) {
      wasTruncated = true;
      // Count how many files we're losing
      truncatedFiles = (diffsText.match(/### File:/g) || []).length - (diffsText.substring(0, MAX_DIFF_LENGTH).match(/### File:/g) || []).length;
      
      diffsText = diffsText.substring(0, MAX_DIFF_LENGTH) + 
        `\n\n⚠️ [DIFF TRUNCATED: ${truncatedFiles} files not shown due to size limit. Original: ${originalLength} chars, showing: ${MAX_DIFF_LENGTH} chars]\n` +
        `💡 To review all changes, use: --max-diff-chars ${originalLength + 1000}`;
    }

    return {
      title: mr.title,
      description: mr.description || 'No description provided',
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      changedFiles: mr.changes?.length || 0,
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
        throw new Error('MR not found. Check the URL and ensure you have access to this project.');
      } else if (error.response.status === 401) {
        throw new Error('Authentication failed. Check your GITLAB_TOKEN.');
      } else {
        throw new Error(`GitLab API error: ${error.response.status} - ${error.response.statusText}`);
      }
    }
    throw error;
  }
}

async function postMRComment(mrUrl, commentBody, projectArg = null) {
  try {
    const { apiBase, projectId, mrIid } = parseMRUrl(mrUrl, projectArg);
    
    const token = process.env.GITLAB_TOKEN;
    if (!token) {
      throw new Error('GITLAB_TOKEN environment variable is not set');
    }

    const headers = {
      'PRIVATE-TOKEN': token,
      'Content-Type': 'application/json'
    };

    console.log('Posting comment to MR...');

    await axios.post(
      `${apiBase}/projects/${projectId}/merge_requests/${mrIid}/notes`,
      { body: commentBody },
      { headers }
    );

    console.log('✓ Comment posted successfully\n');

  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        throw new Error('MR not found. Cannot post comment.');
      } else if (error.response.status === 401 || error.response.status === 403) {
        throw new Error('Authentication failed or insufficient permissions to post comments.');
      } else {
        throw new Error(`GitLab API error: ${error.response.status} - ${error.response.statusText}`);
      }
    }
    throw error;
  }
}

module.exports = { getMergeRequestDiffs, postMRComment };
