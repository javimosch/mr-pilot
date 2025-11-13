# Publication Plan

## Repository Name Options

1. **mr-pilot** ⭐ (Recommended)
   - Short, memorable, brandable
   - Implies guidance and automation
   - Available on npm

2. **codereview-ai**
   - Clear purpose
   - SEO-friendly
   - Straightforward

3. **merge-guardian**
   - Protective connotation
   - Professional sounding
   - Longer but descriptive

4. **reviewbot**
   - Simple, direct
   - Easy to remember
   - Might be taken on npm

**Selected:** `mr-pilot`

## Short Description

**One-liner:** "AI-powered code review for GitLab Merge Requests"

**Detailed:**
```
Automated code review tool that analyzes GitLab Merge Requests using AI.
Get instant feedback on code quality, potential bugs, and requirement
compliance. Supports multiple LLM providers including OpenAI, Ollama,
and OpenRouter.
```

**npm description:**
```
AI code reviewer for GitLab MRs - Get instant feedback on bugs, quality,
and requirements. Works with OpenAI, Ollama, Claude & more.
```

## NPM Binary Name

**Command:** `mr-pilot`

Usage examples:
```bash
# Global install
npm install -g mr-pilot
mr-pilot 1763 -i requirements.txt

# Via npx (no install)
npx mr-pilot https://gitlab.com/project/-/merge_requests/123 --comment

# Local install
npm install mr-pilot
npx mr-pilot 1763 -g guidelines.txt
```

## Landing Page Wireframe

### Hero Section
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🤖 MR Pilot                                 [GitHub] [npm] │
│                                                             │
│         AI-Powered Code Review for GitLab                   │
│                                                             │
│  Get instant, thorough code reviews powered by AI.          │
│  Catch bugs, enforce standards, validate requirements.      │
│                                                             │
│  [Get Started]  [View Demo]                                 │
│                                                             │
│  $ npm install -g mr-pilot                                  │
│  $ mr-pilot 1763 -i spec.txt --comment                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Features Section
```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  Why MR Pilot?                                            │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ 🎯 Focused  │  │ 🔧 Flexible │  │ ⚡ Fast     │      │
│  │             │  │             │  │             │      │
│  │ Reviews     │  │ Multiple    │  │ Automated   │      │
│  │ only what   │  │ LLM         │  │ CI/CD       │      │
│  │ matters     │  │ providers   │  │ integration │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ 📋 Smart    │  │ 🎨 Custom   │  │ 💰 Cost     │      │
│  │             │  │             │  │             │      │
│  │ Guidelines  │  │ Rules &     │  │ Effective   │      │
│  │ reduce      │  │ patterns    │  │ Use free    │      │
│  │ noise       │  │ support     │  │ Ollama      │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Quick Start
```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  Quick Start                                              │
│                                                           │
│  1. Install                                               │
│     npm install -g mr-pilot                               │
│                                                           │
│  2. Configure                                             │
│     # Set your API keys                                   │
│     GITLAB_TOKEN=your_token                               │
│     LLM_API_KEY=your_key                                  │
│                                                           │
│  3. Run                                                   │
│     mr-pilot 1763 -i requirements.txt --comment           │
│                                                           │
│  [Read Full Documentation]                                │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Provider Support
```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  Works With Your Favorite LLMs                            │
│                                                           │
│  OpenRouter  •  OpenAI  •  Ollama  •  Azure  •  Custom   │
│                                                           │
│  [OpenRouter]  [OpenAI]  [Ollama]  [Azure]               │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Examples
```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  Real-World Examples                                      │
│                                                           │
│  # Review with ticket requirements                        │
│  $ mr-pilot 1763 -i ticket.txt                            │
│                                                           │
│  # With project guidelines                                │
│  $ mr-pilot 1763 -i spec.txt -g guidelines.txt            │
│                                                           │
│  # Post results as comment                                │
│  $ mr-pilot 1763 -i spec.txt --comment                    │
│                                                           │
│  # Use local Ollama (free!)                               │
│  $ LLM_PROVIDER=ollama mr-pilot 1763                      │
│                                                           │
│  [See More Examples]                                      │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Footer
```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  MR Pilot                                                 │
│                                                           │
│  [Documentation] [GitHub] [npm] [Issues]                  │
│                                                           │
│  MIT License                                              │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

## Package.json Updates Needed

```json
{
  "name": "mr-pilot",
  "version": "1.0.0",
  "description": "AI code reviewer for GitLab MRs - Get instant feedback on bugs, quality, and requirements",
  "bin": {
    "mr-pilot": "./bin/mr-pilot.js"
  },
  "keywords": [
    "gitlab",
    "merge-request",
    "code-review",
    "ai",
    "llm",
    "openai",
    "ollama",
    "automation",
    "ci-cd"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git@github.com:javimosch/mr-pilot.git"
  },
  "homepage": "git@github.com:javimosch/mr-pilot.git"
}
```

## Files to Create

1. `bin/mr-pilot.js` - Executable wrapper
2. `docs/index.html` - Landing page
3. `.npmignore` - Exclude unnecessary files
4. `LICENSE` - MIT License

## Marketing Points

### Key Benefits
- ✅ **Save time**: Automated reviews in seconds
- ✅ **Catch bugs**: AI finds issues humans miss
- ✅ **Enforce standards**: Consistent code quality
- ✅ **Validate requirements**: Ensure MRs meet specs
- ✅ **Free option**: Use Ollama locally
- ✅ **CI/CD ready**: Integrate into pipelines
- ✅ **Flexible**: Multiple LLM providers
- ✅ **Smart**: Context-aware with guidelines

### Use Cases
1. **Pre-merge validation** - Catch issues before merge
2. **CI/CD pipelines** - Automated quality gates
3. **Large MRs** - Get thorough reviews quickly
4. **Team onboarding** - Consistent feedback for new devs
5. **Compliance** - Validate against requirements
6. **Cost savings** - Use free local models

## Next Steps

1. ✅ Create `bin/mr-pilot.js`
2. ✅ Create landing page at `docs/index.html`
3. Create `.npmignore`
4. Update `package.json`
5. Add LICENSE file
6. Test npm publishing locally
7. Create GitHub repository
8. Enable GitHub Pages
9. Publish to npm
10. Write blog post/announcement
