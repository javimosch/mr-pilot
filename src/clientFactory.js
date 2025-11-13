const { getDiffs: getGitLabDiffs, postComment: postGitLabComment } = require('./gitlabClient');
const { getDiffs: getGitHubDiffs, postComment: postGitHubComment } = require('./githubClient');

function getClient(urlOrId, projectArg = null, platformArg = null) {
  if (!urlOrId) {
    throw new Error('URL or ID is required');
  }
  
  // If platform is explicitly specified, use it
  if (platformArg) {
    if (platformArg === 'github') {
      return {
        getDiffs: getGitHubDiffs,
        postComment: postGitHubComment,
        platform: 'github'
      };
    } else if (platformArg === 'gitlab') {
      return {
        getDiffs: getGitLabDiffs,
        postComment: postGitLabComment,
        platform: 'gitlab'
      };
    }
  }
  
  // Check if it's a GitHub URL
  const githubPattern = /github\.com/;
  const gitlabPattern = /gitlab/;
  
  if (githubPattern.test(urlOrId)) {
    return {
      getDiffs: getGitHubDiffs,
      postComment: postGitHubComment,
      platform: 'github'
    };
  }
  
  if (gitlabPattern.test(urlOrId)) {
    return {
      getDiffs: getGitLabDiffs,
      postComment: postGitLabComment,
      platform: 'gitlab'
    };
  }
  
  // If it's just a number, check for ambiguous project path
  if (/^\d+$/.test(urlOrId)) {
    const project = projectArg || process.env.GITHUB_DEFAULT_REPO || process.env.GITLAB_DEFAULT_PROJECT;
    
    // If project path looks like owner/repo (2 segments), it's ambiguous
    if (project && project.split('/').length === 2) {
      throw new Error(
        `Ambiguous project path "${project}". This could be either a GitLab or GitHub project. ` +
        'Please use the --platform flag to specify: --platform gitlab or --platform github'
      );
    }
  }
  
  // Default to GitLab
  return {
    getDiffs: getGitLabDiffs,
    postComment: postGitLabComment,
    platform: 'gitlab'
  };
}

module.exports = { getClient };