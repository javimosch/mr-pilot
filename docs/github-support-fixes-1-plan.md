# Plan for GitHub Support Remediation

This document outlines the plan to address the issues identified in the AI code review of the initial GitHub support implementation.

### 1. & 2. Fix Client Misclassification Bug

*   **Problem**: The logic in `clientFactory.js` for detecting a GitHub project based on a numeric ID is too simple (`split('/').length === 2`) and incorrectly classifies some GitLab projects as GitHub projects. This is especially problematic if `GITHUB_DEFAULT_REPO` is set.
*   **Solution**:
    1.  Introduce a new optional command-line flag in `src/index.js`: `--platform <gitlab|github>`.
    2.  Update `src/clientFactory.js` to prioritize this flag.
    3.  If the flag is not provided and the project path is ambiguous (e.g., a two-segment path like `group/project`), the tool will throw an error, instructing the user to use the `--platform` flag to resolve the ambiguity.
    4.  Update `README.md` to document the new flag and explain when it's needed.

### 3. Add Unit and Integration Tests

*   **Problem**: The new `githubClient.js` and `clientFactory.js` components lack tests, increasing the risk of future regressions.
*   **Solution**:
    1.  Add a testing framework like `jest` to the project if one doesn't exist.
    2.  Create `src/clientFactory.test.js` with test cases for all detection scenarios (URL, numeric ID, project flag, platform flag, ambiguity).
    3.  Create `src/githubClient.test.js` with mock API tests for `getDiffs` and `postComment`, covering success, not found (404), and authentication error (401) cases.

### 4. Improve Diff Truncation Logic

*   **Problem**: The file truncation logic in `githubClient.js` may inaccurately count the number of truncated files if the diff is cut off in the middle of a file's patch.
*   **Solution**:
    1.  In `githubClient.js`, modify the `getDiffs` function.
    2.  Instead of simply using `substring`, find the last occurrence of `
### File:` that appears before the `MAX_DIFF_LENGTH`.
    3.  Truncate the diff content at that position to ensure that only complete file diffs are included in the truncated output.
    4.  Recalculate the `truncatedFiles` count based on this more accurate truncation.

### 5. Handle API Rate Limiting

*   **Problem**: The `githubClient.js` does not explicitly handle GitHub's rate limiting (HTTP 429), which could lead to failed requests.
*   **Solution**:
    1.  In the error handling logic within `githubClient.js` (`getDiffs` and `postComment`), add a specific check for `error.response.status === 429`.
    2.  When a 429 error is caught, read the `X-RateLimit-Reset` response header to determine when the rate limit will reset.
    3.  Wait for the required amount of time before retrying the request.

### 6. Update README for Ambiguity

*   **Problem**: The `README.md` does not warn users about the potential for ambiguity between GitLab and GitHub project paths.
*   **Solution**:
    1.  After implementing the `--platform` flag (from point 1), update the "Usage" section of `README.md`.
    2.  Clearly document the `--platform` flag and provide an example of when to use it (i.e., when using a numeric ID with a project path like `group/project`).

### 7. Improve `.env.example`

*   **Problem**: `GITLAB_DEFAULT_PROJECT` is an empty string in `.env.example`, which is not a helpful default.
*   **Solution**:
    1.  Update `.env.example` to set `GITLAB_DEFAULT_PROJECT="group/project"`.
    2.  Add a comment explaining that this should be replaced with the user's actual default GitLab project path.

### 8. Make "Retrieved" Log Message Specific

*   **Problem**: The log message `✓ Retrieved: "..."` is generic and doesn't specify whether an MR or PR was fetched.
*   **Solution**:
    1.  The `clientFactory.js` already returns a `platform` string ('gitlab' or 'github').
    2.  In `src/index.js`, use this platform string to create a more descriptive log message, such as `✓ Retrieved GitLab MR: "..."` or `✓ Retrieved GitHub PR: "..."`.

### 9. Reduce Code Duplication in Clients

*   **Problem**: The error handling and retry logic is duplicated across `gitlabClient.js` and `githubClient.js`.
*   **Solution**:
    1.  Create a new utility file, `src/apiUtils.js`.
    2.  Create a generic `makeApiRequest` function in this file that takes an `axios` request config and handles the common retry logic, timeouts, and error logging.
    3.  Refactor `gitlabClient.js` and `githubClient.js` to use this shared utility function for all their API calls.

### 10. Add GitHub Token Scope Validation

*   **Problem**: The application doesn't verify that the provided `GITHUB_TOKEN` has the necessary `repo` scope, which could lead to confusing permissions errors.
*   **Solution**:
    1.  At the beginning of the `getDiffs` function in `githubClient.js`, make a lightweight, initial API call to a GitHub endpoint like `https://api.github.com/user`.
    2.  Check the `X-OAuth-Scopes` header in the response.
    3.  If the `repo` scope is not present, throw a clear, user-friendly error explaining that the token is missing the required permissions.
