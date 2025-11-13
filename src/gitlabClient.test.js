const axios = require('axios');
const { getDiffs, postComment } = require('./gitlabClient');

jest.mock('axios');

describe('gitlabClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITLAB_TOKEN = 'test-token';
    process.env.GITLAB_API = 'https://gitlab.com/api/v4';
    process.env.GITLAB_DEFAULT_PROJECT = 'test-group/test-project';
  });

  describe('getDiffs', () => {
    it('should fetch MR diffs successfully with full URL', async () => {
      const mockResponse = {
        data: {
          title: 'Test MR',
          description: 'Test description',
          source_branch: 'feature',
          target_branch: 'main',
          changes: [
            {
              new_path: 'test.js',
              diff: '@@ -1,3 +1,3 @@\n-old line\n+new line'
            }
          ]
        }
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await getDiffs('https://gitlab.com/test-group/test-project/-/merge_requests/123');

      expect(result.title).toBe('Test MR');
      expect(result.description).toBe('Test description');
      expect(result.changedFiles).toBe(1);
      expect(result.diffs).toContain('test.js');
    });

    it('should handle MR ID with default project', async () => {
      const mockResponse = {
        data: {
          title: 'Test MR',
          description: null,
          source_branch: 'feature',
          target_branch: 'main',
          changes: []
        }
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await getDiffs('123');

      expect(result.title).toBe('Test MR');
      expect(result.description).toBe('No description provided');
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('test-group%2Ftest-project'),
        expect.any(Object)
      );
    });

    it('should truncate diffs when exceeding max chars', async () => {
      const longDiff = 'x'.repeat(60000);
      const mockResponse = {
        data: {
          title: 'Large MR',
          description: 'Test',
          source_branch: 'feature',
          target_branch: 'main',
          changes: [
            { new_path: 'file1.js', diff: longDiff },
            { new_path: 'file2.js', diff: longDiff }
          ]
        }
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await getDiffs('123', null, 50000);

      expect(result.diffStats.wasTruncated).toBe(true);
      expect(result.diffStats.truncatedFiles).toBeGreaterThan(0);
      expect(result.diffs).toContain('DIFF TRUNCATED');
    });
  });

  describe('postComment', () => {
    it('should post comment successfully', async () => {
      axios.post.mockResolvedValue({ data: { id: 1 } });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await postComment('https://gitlab.com/test-group/test-project/-/merge_requests/123', 'Test comment');

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/notes'),
        { body: 'Test comment' },
        expect.any(Object)
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('posted successfully'));

      consoleSpy.mockRestore();
    });

    it('should retry on timeout', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ETIMEDOUT';

      axios.post
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({ data: { id: 1 } });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await postComment('123', 'Test comment');

      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('timed out'));

      consoleSpy.mockRestore();
    });

    it('should throw on 404 error', async () => {
      const error = new Error('Not found');
      error.response = { status: 404 };

      axios.post.mockRejectedValue(error);

      await expect(postComment('123', 'Test comment')).rejects.toThrow('MR not found');
    });
  });
});
