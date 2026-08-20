# Getting Started

English | [日本語](getting-started.ja.md)

A detailed walkthrough for first-time GitHub Actions users. If you already know how to write workflow YAML and register secrets, the [main README's GitHub Action section](../README.md#-github-action) is shorter.

This guide assumes you have a GitHub account but have **never used GitHub Actions before**. Estimated time: 10 minutes.

---

## Prerequisites

- A GitHub account
- 5-10 minutes
- Basic familiarity with creating files on GitHub (via the web UI is fine - no Git CLI needed)

You do **not** need:
- Node.js installed locally
- Docker
- A Personal Access Token (unless you want private contributions in the chart - covered in Step 3)

---

## Step 1. Create your profile repository

GitHub treats a repository named **exactly the same as your username** as your "profile repository" - its README appears at the top of your GitHub profile page.

1. Open <https://github.com/new>
2. **Repository name**: enter your GitHub username (e.g. if your username is `pipipi-dev`, name the repo `pipipi-dev`)
3. **Public** (must be public for the chart image to be embeddable)
4. Check **Add a README file**
5. Click **Create repository**

If this repo already exists, skip to Step 2.

> 💡 GitHub will show a "🎉 Special repository" banner - that's how you know you got the name right.

---

## Step 2. Add the workflow file

Workflow files live in a fixed location: **`.github/workflows/<anything>.yml`** at the root of your repository. GitHub auto-detects any YAML file in this directory and runs it according to its triggers.

### 2a. Create the file via the GitHub web UI

1. On your profile repo page, click **Add file** → **Create new file**
2. In the **filename** field, type exactly:
   ```
   .github/workflows/contribution-chart.yml
   ```
   (typing `/` in the filename automatically creates the folders)
3. Paste this content:

```yaml
name: update contribution chart

on:
  schedule:
    - cron: "0 0 * * *"     # daily at 00:00 UTC
  workflow_dispatch:         # lets you run it manually from the Actions tab
  push:
    branches: [main]         # also run on each push to main

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write        # needed to commit the generated SVG
    steps:
      - uses: pipipi-dev/gcchart@v1
        with:
          outputs: |
            contributions.svg
```

4. Scroll down, click **Commit new file**

That's it - the workflow is registered.

### 2b. Where do parameters go?

The action's input parameters (listed in the [README's Inputs table](../README.md#inputs)) all go inside the **`with:`** block. For example, to generate two charts with different settings:

```yaml
      - uses: pipipi-dev/gcchart@v1
        with:
          outputs: |                                          # ← outputs parameter
            contributions.svg
            contributions-90d.svg?period=90&granularity=day
          target_branch: output                               # ← optional, defaults shown
          commit_message: "chore: update contribution chart"
```

Parameters with a default (everything except none-required ones) can be omitted entirely.

---

## Step 3. (Optional) Set up a token for private contributions

**Skip this step** if you only want public-repo contributions in your chart. The action's default token (`${{ github.token }}`) handles those automatically.

If you want Commits/PRs/Issues from **private repositories** to also count, you need a Personal Access Token (PAT) with `repo` scope.

### 3a. Create the PAT

1. Go to <https://github.com/settings/tokens>
2. Click **Generate new token** → **Generate new token (classic)**
3. **Note**: name it something like `contribution-chart` so you remember why it exists
4. **Expiration**: pick a length (90 days, 1 year, etc. - you'll need to renew when it expires)
5. **Scopes**: check the `repo` box (one click checks all child boxes)
6. Click **Generate token** at the bottom
7. **Copy the `ghp_...` string immediately** - once you leave this page, GitHub will never show it again

### 3b. Register the PAT as a secret

Never paste a PAT directly into a workflow file (it would be in your commit history forever). Instead, store it as a "secret" - GitHub keeps it encrypted and only exposes it to your workflows at runtime.

1. Open your profile repo's **Settings** tab
2. Left sidebar: **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. **Name**: `GH_PAT` (any name works, but it must NOT start with `GITHUB_` - that prefix is reserved)
5. **Secret**: paste the `ghp_...` you copied in step 3a-7
6. Click **Add secret**

### 3c. Reference the secret in your workflow

Edit `.github/workflows/contribution-chart.yml` and add the `github_token` line:

```yaml
      - uses: pipipi-dev/gcchart@v1
        with:
          github_token: ${{ secrets.GH_PAT }}   # ← references the secret name from 3b-4
          outputs: |
            contributions.svg
```

`${{ secrets.GH_PAT }}` is replaced with the actual PAT value at runtime, and GitHub automatically masks it (`***`) in any log output.

### 3d. Enable "Include private contributions" on your profile

GitHub also has a per-user toggle that affects whether private repo activity is exposed via the API:

1. Open <https://github.com/settings/profile>
2. Scroll to **Contributions & Activity**
3. Check **Include private contributions on my profile**
4. **Save**

Without this, even a `repo`-scoped PAT will return zero private contributions.

---

## Step 4. Run the workflow manually

The workflow we set up runs once a day via cron, but waiting that long for the first verification is no fun. Use the manual trigger:

1. Open your profile repo on GitHub
2. Click the **Actions** tab (top of the page)
3. In the left sidebar, click **update contribution chart** (the workflow name from `name:` in the YAML)
4. On the right, you'll see a banner: **"This workflow has a workflow_dispatch event trigger."** Click **Run workflow** → **Run workflow** (the green button)
5. After ~5 seconds, refresh the page. A new run will appear with a yellow ⏳ icon
6. Click into it to watch progress. Each step expands to show its log

Expected duration: **30 seconds to 2 minutes** depending on your contribution volume.

When it finishes successfully, you'll see all green ✅ icons.

---

## Step 5. Embed the chart in your profile README

The workflow committed `contributions.svg` to a new branch called `output` (separate from `main`). You can verify it exists by switching the branch dropdown on your repo page from `main` to `output`.

To display the chart on your profile, edit `README.md` on the **`main`** branch and add:

```markdown
![contributions](https://raw.githubusercontent.com/your-username/your-username/output/contributions.svg)
```

Replace **both** `your-username` placeholders with your actual GitHub username.

Commit the change. Visit `https://github.com/your-username` - your chart should now appear at the top of your profile.

---

## Troubleshooting

### The Actions tab is empty / "No workflows" message
The YAML file isn't in the right place. It must be at exactly `.github/workflows/<name>.yml` on the **default branch** (usually `main`). Verify the path on GitHub.

### Workflow runs but fails with "Resource not accessible by integration"
The `permissions: contents: write` line is missing or misspelled. The action needs write permission to commit the generated SVG.

### Chart shows but private contributions are missing
Three things must all be true:
1. PAT has `repo` scope (not just `read:user`)
2. PAT is correctly registered as a secret and referenced via `${{ secrets.NAME }}`
3. **Include private contributions on my profile** is enabled (Step 3d)

### Image doesn't load on the profile README
- Check the URL: it must be `raw.githubusercontent.com/your-username/your-username/output/contributions.svg` with **your actual username** (not the literal string `your-username`)
- Confirm the `output` branch exists and contains `contributions.svg` (switch branch dropdown to verify)
- GitHub caches images via Camo for ~5 minutes - wait a bit if you just pushed

### "Bad credentials" error in the Action log
The PAT has expired. Create a new one (Step 3a) and update the secret value (Settings → Secrets and variables → Actions → click `GH_PAT` → **Update**).

### Cron isn't running on schedule
GitHub may delay or skip cron triggers on free-tier repos with low recent activity. Consider triggering on `push` to `main` as a backup, or use `workflow_dispatch` manually when needed.

---

## Next steps

- [Customize the chart](../README.md#output-query-string-options) - change the period, style, theme, or aggregation granularity
- [Embed multiple variants](../README.md#embed-both-90-day-and-365-day-views) - e.g. both 90-day daily and 1-year weekly views
- [Force Light/Dark with `<picture>`](../README.md#force-light--dark-with-picture) - match GitHub's theme setting instead of the viewer's OS

If something still isn't working, please [open an issue](https://github.com/pipipi-dev/gcchart/issues) with:
- The relevant section of your workflow YAML (with secrets redacted)
- A link to the failing Action run
- What you expected vs. what happened
