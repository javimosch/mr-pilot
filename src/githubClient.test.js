const { getDiffs, postComment } = require('./githubClient');
const axios = require('axios');

jest.mock('axios');

describe('githubClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  describe('getDiffs', () => {
    test('should fetch PR diffs successfully', async () => {
      const mockUserResponse = {
        data: {},
        headers: { 'x-oauth-scopes': 'repo' }
      };
      const mockPRResponse = {
        data: {
          title: 'Test PR',
          body: 'Test description',
          head: { ref: 'feature-branch' },
          base: { ref: 'main' }
        }
      };
      const mockFilesResponse = {
        data: [
          {
            filename: 'test.js',
            patch: '@@ -1,3 +1,3 @@\n-old line\n+new line'
          }
        ]
      };

      axios.get
        .mockResolvedValueOnce(mockUserResponse)
        .mockResolvedValueOnce(mockPRResponse)
        .mockResolvedValueOnce(mockFilesResponse);

      const result = await getDiffs('https://github.com/owner/repo/pull/123');

      expect(result.title).toBe('Test PR');
      expect(result.sourceBranch).toBe('feature-branch');
      expect(result.targetBranch).toBe('main');
      expect(result.changedFiles).toBe(1);
    });

    test('should throw error when PR not found', async () => {
      const mockUserResponse = {
        data: {},
        headers: { 'x-oauth-scopes': 'repo' }
      };

      axios.get
        .mockResolvedValueOnce(mockUserResponse)
        .mockRejectedValueOnce({
          response: { status: 404 }
        });

      await expect(getDiffs('https://github.com/owner/repo/pull/999'))
        .rejects.toThrow('PR not found');
    });

    test('should throw error when authentication fails', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 401 }
      });

      await expect(getDiffs('https://github.com/owner/repo/pull/123'))
        .rejects.toThrow('Authentication failed');
    });

    test('should throw error when token missing', async () => {
      delete process.env.GITHUB_TOKEN;

      await expect(getDiffs('https://github.com/owner/repo/pull/123'))
        .rejects.toThrow('GITHUB_TOKEN environment variable is not set');
    });
  });

  describe('postComment', () => {
    test('should post comment successfully', async () => {
      axios.post.mockResolvedValueOnce({ data: {} });

      await expect(postComment('https://github.com/owner/repo/pull/123', 'Test comment'))
        .resolves.not.toThrow();

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/issues/123/comments'),
        { body: 'Test comment' },
        expect.any(Object)
      );
    });

    test('should retry on rate limit and succeed', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 2;
      
      axios.post
        .mockRejectedValueOnce({
          response: {
            status: 429,
            headers: { 'x-ratelimit-reset': futureTimestamp.toString() }
          }
        })
        .mockResolvedValueOnce({ data: {} });

      await expect(postComment('https://github.com/owner/repo/pull/123', 'Test comment'))
        .resolves.not.toThrow();

      expect(axios.post).toHaveBeenCalledTimes(2);
    }, 10000);

    test('should throw error when PR not found', async () => {
      axios.post.mockRejectedValueOnce({
        response: { status: 404 }
      });

      await expect(postComment('https://github.com/owner/repo/pull/999', 'Test'))
        .rejects.toThrow('PR not found');
    });
  });
});
