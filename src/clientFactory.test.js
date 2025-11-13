const { getClient } = require('./clientFactory');

// Mock the client modules
jest.mock('./gitlabClient', () => ({
  getDiffs: jest.fn(),
  postComment: jest.fn()
}));

jest.mock('./githubClient', () => ({
  getDiffs: jest.fn(),
  postComment: jest.fn()
}));

describe('clientFactory', () => {
  beforeEach(() => {
    delete process.env.GITHUB_DEFAULT_REPO;
    delete process.env.GITLAB_DEFAULT_PROJECT;
  });

  describe('URL detection', () => {
    test('should detect GitHub from URL', () => {
      const client = getClient('https://github.com/owner/repo/pull/123');
      expect(client.platform).toBe('github');
    });

    test('should detect GitLab from URL', () => {
      const client = getClient('https://gitlab.com/group/project/-/merge_requests/456');
      expect(client.platform).toBe('gitlab');
    });
  });

  describe('Platform flag', () => {
    test('should use platform flag when specified as github', () => {
      const client = getClient('123', 'owner/repo', 'github');
      expect(client.platform).toBe('github');
    });

    test('should use platform flag when specified as gitlab', () => {
      const client = getClient('456', 'group/project', 'gitlab');
      expect(client.platform).toBe('gitlab');
    });
  });

  describe('Ambiguous project path', () => {
    test('should throw error for ambiguous 2-segment path without platform flag', () => {
      expect(() => {
        getClient('123', 'owner/repo');
      }).toThrow(/Ambiguous project path/);
    });

    test('should not throw for 3-segment GitLab path', () => {
      const client = getClient('123', 'group/subgroup/project');
      expect(client.platform).toBe('gitlab');
    });
  });

  describe('Default behavior', () => {
    test('should default to GitLab for numeric ID without project', () => {
      const client = getClient('789');
      expect(client.platform).toBe('gitlab');
    });

    test('should throw error for null or undefined input', () => {
      expect(() => getClient(null)).toThrow('URL or ID is required');
      expect(() => getClient(undefined)).toThrow('URL or ID is required');
    });
  });
});
