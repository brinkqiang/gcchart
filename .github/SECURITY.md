# Security Policy

English | [日本語](SECURITY.ja.md)

## Reporting a vulnerability

If you discover a security vulnerability in gcchart, please **do not open a public issue**. Instead, report it privately via GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) feature on this repository's Security tab.

When reporting, please include:

- A description of the vulnerability and its impact
- Steps to reproduce
- The version (release tag or commit SHA) you tested against
- Any suggested mitigation, if known

You'll get an acknowledgement within a few days. Fixes are released as patch versions; the affected versions are noted in the published advisory.

## Token handling

This action requires a GitHub token (defaulting to `${{ github.token }}`) to:

1. Read your contribution data via the GraphQL API
2. Commit the generated SVG to the `output` branch

The token is **never written to disk** outside the temporary clone directory used during the push and is **redacted from any error message** before being re-thrown. It is, however, present in the remote URL of the temporary git config - that directory lives only for the duration of the action run and is automatically cleaned up.

If you supply a Personal Access Token (e.g. for private contributions), use the **least-privilege scope** that meets your needs:

- `read:user` - public contributions only
- `repo` - required only when you want private contributions in the chart
