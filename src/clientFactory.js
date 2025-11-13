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
  
  // If it's just a number, auto-select based on configured defaults
  if (/^\d+$/.test(urlOrId)) {
    const githubRepo = projectArg || process.env.GITHUB_DEFAULT_REPO;
    const gitlabProject = process.env.GITLAB_DEFAULT_PROJECT;
    
    // Auto-select GitHub if GITHUB_DEFAULT_REPO is configured (2 segments = GitHub)
    if (githubRepo && githubRepo.trim() && githubRepo.split('/').length === 2) {
      return {
        getDiffs: getGitHubDiffs,
        postComment: postGitHubComment,
        platform: 'github'
      };
    }
    
    // Auto-select GitLab if GITLAB_DEFAULT_PROJECT is configured or project has 3+ segments
    if ((gitlabProject && gitlabProject.trim()) || (githubRepo && githubRepo.split('/').length >= 3)) {
      return {
        getDiffs: getGitLabDiffs,
        postComment: postGitLabComment,
        platform: 'gitlab'
      };
    }
  }
  
  // Default to GitLab if no configuration found
  return {
    getDiffs: getGitLabDiffs,
    postComment: postGitLabComment,
    platform: 'gitlab'
  };
}

module.exports = { getClient };