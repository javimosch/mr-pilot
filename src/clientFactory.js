const { getDiffs: getGitLabDiffs, postComment: postGitLabComment } = require('./gitlabClient');
const { getDiffs: getGitHubDiffs, postComment: postGitHubComment } = require('./githubClient');

function getClient(urlOrId) {
  if (!urlOrId) {
    throw new Error('URL or ID is required');
  }
  
  // Check if it's a GitHub URL
  const githubPattern = /github\.com/;
  
  if (githubPattern.test(urlOrId)) {
    return {
      getDiffs: getGitHubDiffs,
      postComment: postGitHubComment,
      platform: 'github'
    };
  }
  
  // Default to GitLab
  return {
    getDiffs: getGitLabDiffs,
    postComment: postGitLabComment,
    platform: 'gitlab'
  };
}

module.exports = { getClient };
