const axios = require('axios');

function parseMRUrl(input) {
  if (!input) {
    throw new Error('MR URL or ID is required');
  }

  // If it's just a number, treat it as MR IID (need project ID too)
  if (/^\d+$/.test(input)) {
    throw new Error('Please provide full MR URL, not just ID');
  }

  // Parse GitLab MR URL format: https://gitlab.domain/project/path/-/merge_requests/123
  const urlPattern = /https?:\/\/([^\/]+)\/(.+?)\/-\/merge_requests\/(\d+)/;
  const match = input.match(urlPattern);

  if (!match) {
    throw new Error('Invalid GitLab MR URL format. Expected: https://gitlab.domain/project/path/-/merge_requests/123');
  }

  const [, domain, projectPath, mrIid] = match;
  
  // URL encode the project path
  const projectId = encodeURIComponent(projectPath);

  return {
    domain,
    projectId,
    mrIid,
    apiBase: `https://${domain}/api/v4`
  };
}

async function getMergeRequestDiffs(mrUrl) {
  try {
    const { apiBase, projectId, mrIid } = parseMRUrl(mrUrl);
    
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
    if (mr.changes && mr.changes.length > 0) {
      diffsText = mr.changes.map(change => {
        const filePath = change.new_path || change.old_path;
        return `\n### File: ${filePath}\n${change.diff}`;
      }).join('\n');
    }

    // Limit diff size for POC
    const MAX_DIFF_LENGTH = 15000;
    if (diffsText.length > MAX_DIFF_LENGTH) {
      diffsText = diffsText.substring(0, MAX_DIFF_LENGTH) + '\n\n[... diff truncated due to size ...]';
    }

    return {
      title: mr.title,
      description: mr.description || 'No description provided',
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      changedFiles: mr.changes?.length || 0,
      diffs: diffsText
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

async function postMRComment(mrUrl, commentBody) {
  try {
    const { apiBase, projectId, mrIid } = parseMRUrl(mrUrl);
    
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
