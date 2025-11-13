# GitHub Support Implementation Plan

This document outlines the plan to add GitHub support to the `mr-pilot` tool.

## Summary of Changes

The project is well-structured to support adding a new Git provider. The core logic is largely decoupled from the GitLab-specific implementation. The plan is to introduce a client abstraction layer. A `clientFactory.js` will be created to determine whether to use a `gitlabClient.js` or a new `githubClient.js` based on the input URL. The main application logic in `index.js` will be modified to use this factory. The existing `gitlabClient.js` will be slightly refactored to use generic function names (like `getDiffs` and `postComment`), and a new `githubClient.js` will be created to implement this same interface for GitHub's API. Finally, minor text changes in the output formatter and updates to documentation are required.

## Detailed Steps

### 1. Create a Client Factory

- **File:** `src/clientFactory.js` (new file)
- **Purpose:** To determine which client (GitLab or GitHub) to use based on the provided URL.
- **Key Symbols:**
    - `getClient`: A function that takes a URL as input and returns an instance of the appropriate client.

### 2. Create the GitHub Client

- **File:** `src/githubClient.js` (new file)
- **Purpose:** To encapsulate all interactions with the GitHub API.
- **Key Symbols:**
    - `getDiffs`: To fetch the diff of a pull request.
    - `postComment`: To post a comment on a pull request.
    - `parsePRUrl`: To parse the GitHub pull request URL.

### 3. Refactor the GitLab Client

- **File:** `src/gitlabClient.js`
- **Purpose:** To align with the generic client interface.
- **Changes:**
    - Rename `getMergeRequestDiffs` to `getDiffs`.
    - Rename `postMRComment` to `postComment`.

### 4. Update the Main Application Logic

- **File:** `src/index.js`
- **Purpose:** To use the new client factory instead of directly using the GitLab client.
- **Changes:**
    - Remove the direct import of `gitlabClient.js`.
    - Import and use `clientFactory.js` to get the correct client.
    - Call the generic methods (`getDiffs`, `postComment`) on the client instance.

### 5. Make Output Formatter Generic

- **File:** `src/outputFormatter.js`
- **Purpose:** To remove provider-specific text.
- **Changes:**
    - In `formatCommentBody`, change "GitLab MR Review Bot" to a more generic name like "AI Code Review Bot".

### 6. Update Documentation and Configuration

- **File:** `README.md`
- **Purpose:** To add instructions for using the tool with GitHub.
- **Changes:**
    - Explain the format for GitHub pull request URLs.
    - Document the `GITHUB_TOKEN` environment variable.

- **File:** `.env.example`
- **Purpose:** To include the new environment variable for GitHub.
- **Changes:**
    - Add `GITHUB_TOKEN=""`.
