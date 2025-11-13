const { getDiffs: getGitLabDiffs, postComment: postGitLabComment } = require('./gitlabClient');
const { getDiffs: getGitHubDiffs, postComment: postGitHubComment } = require('./githubClient');

function getClient(urlOrId, projectArg = null) {
  if (!urlOrId) {
    throw new Error('URL or ID is required');
  }

  // Check if it's a GitHub URL
  const githubUrlPattern = /github\.com/;
  if (githubUrlPattern.test(urlOrId)) {
    return {
      getDiffs: getGitHubDiffs,
      postComment: postGitHubComment,
      platform: 'github'
    };
  }

  // Check if it's a numeric ID with a GitHub-style project argument or env
  const isNumericId = /^\d+$/.test(urlOrId);
  const projectIdentifier = projectArg || process.env.GITHUB_DEFAULT_REPO;
  const isGitHubProjectFormat = projectIdentifier && projectIdentifier.split('/').length === 2;

  if (isNumericId && isGitHubProjectFormat) {
      return {
        getDiffs: getGitHubDiffs,
        postComment: postGitHubComment,
        platform: 'github'
      };
  }

  // Default to GitLab for all other cases
  return {
    getDiffs: getGitLabDiffs,
    postComment: postGitLabComment,
    platform: 'gitlab'
  };
}

module.exports = { getClient };