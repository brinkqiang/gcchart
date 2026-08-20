<p align="center">
  <a href="https://github.com/pipipi-dev/gcchart">
    <img src=".github/assets/logo.svg" width="80" alt="gcchart" />
  </a>
</p>

<h1 align="center">gcchart</h1>

<p align="center">
  GitHub Contribution Chart
</p>

<p align="center">
  English | <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://www.npmjs.com/package/gcchart"><img src="https://img.shields.io/npm/v/gcchart?logo=npm" alt="npm version" /></a>
  <a href="https://github.com/pipipi-dev/gcchart/releases"><img src="https://img.shields.io/github/v/release/pipipi-dev/gcchart?logo=github" alt="GitHub release" /></a>
  <a href="https://github.com/marketplace/actions/gcchart"><img src="https://img.shields.io/badge/marketplace-gcchart-blue?logo=github" alt="GitHub marketplace" /></a>
  <a href="https://github.com/pipipi-dev/gcchart/stargazers"><img src="https://img.shields.io/github/stars/pipipi-dev/gcchart?style=social" alt="Stars" /></a>
</p>

<p align="center">
  Stacked bar chart of your daily GitHub contributions - broken down by Commits / PRs / Issues / Reviews, with an optional cumulative total line.
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="sample/default-dark.svg">
  <img alt="GitHub Contribution Chart - daily contributions broken down by type" src="sample/default-light.svg" width="900" height="600">
</picture>

🌐 **[Live preview](https://pipipi-dev.github.io/gcchart/)** - toggle Light/Dark and copy Markdown snippets for each variant.

> ⭐ If this helps you tell your contribution story, please consider starring the repo.

---

## ✨ Features

- 🌱 **Stacked bar chart** - daily contributions broken down by Commits / PRs / Issues / Reviews
- ✏️ **Hand-drawn style by default** - warm, distinctive look (switch to `style=clean` for a formal line drawing)
- 📅 **Any time range** - day / week / month granularity, from a few days up to multi-year views
- 📈 **Optional total line** - long-term growth at a glance, on a secondary axis
- 🎨 **Auto Light/Dark** - follows your OS theme setting automatically
- ⚡ **Lightweight & self-contained** - a single SVG file, no JS or external assets
- 🎉 **One-shot or continuous** - `npx gcchart` for local SVG generation, GitHub Action for continuous profile updates

## 🚀 Quick Start

```bash
npx gcchart
```

That's it. The CLI prompts for your GitHub username + token, then renders every variant locally with copy-pasteable Markdown - perfect for your README or SNS sharing.

For continuous profile updates, see the [GitHub Action](#-github-action) below.

## 🪄 CLI

Run `npx gcchart` for one-shot SVG generation - Node.js 20+ required, no install.

```bash
npx gcchart
```

The CLI will:

1. Prompt for **GitHub username** + **token** (token input is hidden)
2. Fetch your contributions and render every variant
3. Open `contribution-chart/index.html` for previewing + copy-pasteable Markdown
4. Offer to share one variant on X (Twitter)

Skip prompts with env or flags:

```bash
GITHUB_TOKEN=ghp_xxx GITHUB_USER=your-username npx gcchart
npx gcchart -t ghp_xxx -u your-username -o ./my-charts
```

### Share to X

Answer **Yes** at the share prompt and the CLI:

- Converts the chosen variant to PNG → copies it to your clipboard
- Opens X's post composer in your browser, tweet text pre-filled
- You just paste the image (**Ctrl / Cmd + V**) and post

Pass `--no-share` to skip.

### Token

Get a [classic PAT](https://github.com/settings/tokens) from your GitHub settings.

| Scope | What you get |
|---|---|
| `read:user` | Public contributions only |
| `read:user` + `repo` | Public + private contributions (also enable "Include private contributions on my profile" in your settings) |

> 💡 **About the two totals in the share tweet**: GitHub's GraphQL API doesn't
> expose private-repo contribution detail (only their count), so the bars in
> the chart reflect only what gcchart can see. The tweet shows both
> `Visible total` (chart bar sum) and `GitHub total` (your profile-page
> number, including private and restricted contributions). The two will
> match if all your activity is in public repos.

<details>
<summary>Or clone the repo (useful for hacking on the rendering code)</summary>

```bash
git clone https://github.com/pipipi-dev/gcchart.git
cd gcchart
npm install
GITHUB_TOKEN=ghp_xxx GITHUB_USER=your-username npm run fetch
```

Output lands in `./contribution-chart/`.
</details>

## 🤖 GitHub Action

> 👶 **New to GitHub Actions?** See the [Getting Started guide](docs/getting-started.md). Covers YAML placement, token registration, and common pitfalls (~10 min).

Use as a GitHub Action to keep your profile README continuously up to date. Add this workflow to your profile repository (`your-username/your-username`):

```yaml
# .github/workflows/contribution-chart.yml
name: update contribution chart

on:
  schedule:
    - cron: "0 0 * * *"   # daily at 00:00 UTC
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write   # required to commit the generated SVG
    steps:
      - uses: pipipi-dev/gcchart@v1
        with:
          outputs: |
            contributions.svg
```

Embed in your profile `README.md`:

```markdown
![contributions](https://raw.githubusercontent.com/your-username/your-username/output/contributions.svg)
```

The action commits the SVG to the `output` branch (force-pushed every run - don't store anything else there).

### Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `github_user_name` | - | `${{ github.repository_owner }}` | GitHub username to read contributions from. Defaults to the repo owner - usually correct when the workflow runs in your `your-username/your-username` profile repo |
| `github_token` | - | `${{ github.token }}` | Token used for the GraphQL API and for committing the output |
| `outputs` | - | `contributions.svg` | List of files to generate (one per line). Each can be customized via query string (see below). Lines starting with `#` are treated as comments |
| `target_branch` | - | `output` | Branch to commit generated SVGs to. Created automatically if it doesn't exist |
| `commit_message` | - | `chore: update contribution chart` | Commit message used when pushing to `target_branch` |

### Output query-string options

| Option | Values | Default | Description |
|---|---|---|---|
| `period` | positive integer (days) | `365` | Time range in days. No upper bound; auto-clamped to your account creation date |
| `granularity` | `day` \| `week` \| `month` | `auto` | Aggregation. When `auto`: `day` for ≤ 90 days, `week` for ≤ 2 years, `month` beyond |
| `cumulative` | `true` \| `false` | `true` | Overlay the running total line (labeled `Total`) on a secondary axis |
| `style` | `sketchy` \| `clean` | `sketchy` | Rendering style. `sketchy` is hand-drawn; `clean` is a formal line drawing |
| `theme` | `auto` \| `light` \| `dark` | `auto` | Force a theme, or `auto` for `prefers-color-scheme` |
| `types` | comma-separated subset of `commit,pr,issue,review` | all | Which contribution types to include in the stack |

### Examples

```yaml
outputs: |
  contributions.svg                                              # last 1 year, weekly, sketchy (matches the GitHub profile grid)
  contributions-clean.svg?style=clean                             # formal line-drawing style
  contributions-90d.svg?period=90&granularity=day                 # last 90 days, daily
  contributions-2y-weekly.svg?period=730&granularity=week         # last 2 years, weekly
  contributions-all-monthly.svg?period=3650&granularity=month     # last 10 years, monthly
  contributions-noline.svg?cumulative=false                       # without total line
  contributions-commits-only.svg?types=commit&cumulative=false    # commits only
```

### Including private contributions

The default `${{ github.token }}` only sees public repos. For private:

1. Create a PAT with `repo` scope
2. Add it as a [secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets) (e.g. `GH_PAT`)
3. Pass it: `github_token: ${{ secrets.GH_PAT }}`
4. Enable "Include private contributions on my profile" in your GitHub settings

### Customization

#### Embed both 90-day and 365-day views

```yaml
outputs: |
  contributions.svg
  contributions-90d.svg?period=90&granularity=day
```

```markdown
![last 1 year](https://raw.githubusercontent.com/your-username/your-username/output/contributions.svg)
![last 90 days](https://raw.githubusercontent.com/your-username/your-username/output/contributions-90d.svg)
```

#### Force Light / Dark with `<picture>`

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://.../contributions.svg?theme=dark" />
  <img src="https://.../contributions.svg?theme=light" />
</picture>
```

`theme=auto` (the default) already handles Light/Dark inside a single SVG, so this is normally unnecessary.

### How it works

1. Fetch contributions via the GitHub GraphQL API (`contributionsCollection`)
2. Aggregate per-day counts (Commits / PRs / Issues / Reviews)
3. Render a hand-crafted SVG (no JS runtime, embedded `<style>`)
4. Force-push to the `output` branch (created if missing)
5. Profile README references it via `raw.githubusercontent.com`

The action runs in **your own** repo's Actions environment - no central server, no shared rate limits, served via GitHub's CDN.

## 🙏 Credits

The hand-drawn style is inspired by the charts in [`star-history/star-history`](https://github.com/star-history/star-history).

## 🛸 License

MIT

---

Made with ❤️ for your GitHub story.
