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
  <a href="README.md">English</a> | 日本語
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://www.npmjs.com/package/gcchart"><img src="https://img.shields.io/npm/v/gcchart?logo=npm" alt="npm version" /></a>
  <a href="https://github.com/pipipi-dev/gcchart/releases"><img src="https://img.shields.io/github/v/release/pipipi-dev/gcchart?logo=github" alt="GitHub release" /></a>
  <a href="https://github.com/marketplace/actions/gcchart"><img src="https://img.shields.io/badge/marketplace-gcchart-blue?logo=github" alt="GitHub marketplace" /></a>
  <a href="https://github.com/pipipi-dev/gcchart/stargazers"><img src="https://img.shields.io/github/stars/pipipi-dev/gcchart?style=social" alt="Stars" /></a>
</p>

<p align="center">
  日々の GitHub contribution を積み上げ棒グラフで可視化 - Commits / PRs / Issues / Reviews に分けて表示、累積折れ線も任意で重ねられます。
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="sample/default-dark.svg">
  <img alt="GitHub Contribution Chart - daily contributions broken down by type" src="sample/default-light.svg" width="900" height="600">
</picture>

🌐 **[サンプルをライブプレビュー](https://pipipi-dev.github.io/gcchart/)** - Light/Dark を切り替えて各バリエーションの Markdown スニペットをコピーできます。

> ⭐ あなたの contribution の物語を伝える助けになったら、ぜひスターをお願いします。

---

## ✨ 機能

- 🌱 **積み上げ棒グラフ** - 日次の contribution を Commits / PRs / Issues / Reviews に分けて表示
- ✏️ **手書き風スタイル（デフォルト）** - 温かみのある外観（`style=clean` でフォーマルな線画に切替可）
- 📅 **任意の表示期間** - 日 / 週 / 月の集約粒度と組み合わせ、数日〜複数年まで自在
- 📈 **任意の累積折れ線** - 第 2 軸に重ねて長期的な成長を可視化
- 🎨 **Light / Dark 自動切替** - OS のテーマ設定に追従して自動で切り替わる
- ⚡ **軽量・単体で動作** - 単一の SVG ファイル、JS や外部アセット不要
- 🎉 **ワンショット利用 と プロフィール継続更新** - `npx gcchart` でローカル生成、GitHub Action で自動更新

## 🚀 クイックスタート

```bash
npx gcchart
```

これだけ。CLI が GitHub ユーザー名とトークンを対話で聞いて、全バリエーションをローカルでレンダリング - README にも SNS シェアにもそのまま使える Markdown スニペット付き。

プロフィール継続更新は [GitHub Action](#-github-action) を参照。

## 🪄 CLI

`npx gcchart` でワンショット SVG 生成 - Node.js 20 以上、インストール不要：

```bash
npx gcchart
```

CLI の流れ：

1. **GitHub ユーザー名** と **トークン** を対話で取得（トークン入力は非表示）
2. contribution データを取得して全バリエーションをレンダリング
3. `contribution-chart/index.html` をブラウザで開けばプレビュー＋ Markdown コピー可能
4. X (Twitter) シェアの対話プロンプト

対話をスキップする場合：

```bash
GITHUB_TOKEN=ghp_xxx GITHUB_USER=your-username npx gcchart
npx gcchart -t ghp_xxx -u your-username -o ./my-charts
```

### X (Twitter) へのシェア

シェアプロンプトで **Yes** を選ぶと：

- 選択したバリエーションを PNG 化 → クリップボードにコピー
- ブラウザで X のポスト画面（本文入力済み）を自動オープン
- あとは **Ctrl / Cmd + V** で画像を貼って投稿

`--no-share` でスキップ可。

### トークン

[GitHub の Personal access tokens 設定](https://github.com/settings/tokens) で classic な PAT を作成。

| スコープ | 取得できる contribution |
|---|---|
| `read:user` | public のみ |
| `read:user` + `repo` | public + private（加えてプロフィール設定の「Include private contributions on my profile」も ON に）|

> 💡 **シェア時の 2 つの Total について**: GitHub GraphQL API は private リポジトリ
> contribution の詳細を返さない（件数のみ取得可能）ため、グラフの bars は gcchart
> が取得できた範囲のみを反映します。Tweet には `Visible total`（グラフ bars 合計）
> と `GitHub total`（プロフィール画面の数値、private/restricted 込み）の両方を
> 表示します。すべてが public リポジトリでの活動なら 2 つの値は一致します。

<details>
<summary>リポジトリを clone（レンダリングコードを改造したい場合）</summary>

```bash
git clone https://github.com/pipipi-dev/gcchart.git
cd gcchart
npm install
GITHUB_TOKEN=ghp_xxx GITHUB_USER=your-username npm run fetch
```

出力は `./contribution-chart/` に作成されます。
</details>

## 🤖 GitHub Action

> 👶 **GitHub Actions が初めての方** は、[セットアップガイド](docs/getting-started.ja.md) をご覧ください（YAML の置き場所、トークン登録、Actions タブ操作、よくあるつまずきを 10 分で解説）。

GitHub Action としてプロフィール README を継続更新できます。プロフィールリポジトリ（`your-username/your-username`）に以下を追加：

```yaml
# .github/workflows/contribution-chart.yml
name: update contribution chart

on:
  schedule:
    - cron: "0 0 * * *"   # 毎日 00:00 UTC
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write   # output ブランチへのコミットに必須
    steps:
      - uses: pipipi-dev/gcchart@v1
        with:
          outputs: |
            contributions.svg
```

プロフィールの `README.md` で参照：

```markdown
![contributions](https://raw.githubusercontent.com/your-username/your-username/output/contributions.svg)
```

Action が contribution を取得・SVG を生成し、`output` ブランチに force-push します（毎回上書き、他のものを置かないでください）。

### 入力パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `github_user_name` | - | `${{ github.repository_owner }}` | contribution を取得する GitHub ユーザー名。デフォルトはリポジトリ所有者で、通常 `your-username/your-username` プロフィールリポジトリで動かす場合はこのままで問題ありません |
| `github_token` | - | `${{ github.token }}` | GraphQL API 呼び出しと出力ブランチへのコミットに使うトークン |
| `outputs` | - | `contributions.svg` | 生成するファイル一覧（1 行 1 ファイル）。各行はクエリ文字列でカスタマイズ可（後述）。`#` で始まる行はコメントとして無視されます |
| `target_branch` | - | `output` | 生成した SVG をコミットするブランチ。存在しない場合は自動作成 |
| `commit_message` | - | `chore: update contribution chart` | `target_branch` への push 時のコミットメッセージ |

### 出力ファイルのクエリ文字列オプション

| オプション | 値 | デフォルト | 説明 |
|---|---|---|---|
| `period` | 正の整数（日数） | `365` | 表示する期間（日数）。上限なし。アカウント作成日以降に自動クランプ |
| `granularity` | `day` \| `week` \| `month` | `auto` | 集約粒度。`auto` の場合は `period` から自動選択（〜90 日: `day` / 〜2 年: `week` / それ以上: `month`） |
| `cumulative` | `true` \| `false` | `true` | 第 2 軸に累積折れ線（凡例上は `Total`）を重ねる |
| `style` | `sketchy` \| `clean` | `sketchy` | 描画スタイル。`sketchy` は手書き風、`clean` はフォーマルな線画 |
| `theme` | `auto` \| `light` \| `dark` | `auto` | テーマ固定。`auto` なら `prefers-color-scheme` に追従 |
| `types` | `commit,pr,issue,review` のカンマ区切り部分集合 | 全種類 | 積み上げに含める contribution 種別 |

### 設定例

```yaml
outputs: |
  contributions.svg                                              # 直近 1 年（週次集約、手書き風、GitHub プロフィールと同じ粒度）
  contributions-clean.svg?style=clean                             # フォーマルな線画スタイル
  contributions-90d.svg?period=90&granularity=day                 # 直近 90 日（日次）
  contributions-2y-weekly.svg?period=730&granularity=week         # 直近 2 年（週次集約）
  contributions-all-monthly.svg?period=3650&granularity=month     # 直近 10 年（月次集約）
  contributions-noline.svg?cumulative=false                       # 累積線なし
  contributions-commits-only.svg?types=commit&cumulative=false    # commit のみ
```

### private リポジトリの contribution を含めたい場合

デフォルトの `${{ github.token }}` は public しか取得できません。private を含めるには：

1. `repo` スコープの PAT を作成
2. [secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets) として登録（例: `GH_PAT`）
3. workflow で `github_token: ${{ secrets.GH_PAT }}` を指定
4. プロフィール設定の「Include private contributions on my profile」を ON に

### カスタマイズ

#### 90 日と 365 日の両方を埋め込む

```yaml
outputs: |
  contributions.svg
  contributions-90d.svg?period=90&granularity=day
```

```markdown
![last 1 year](https://raw.githubusercontent.com/your-username/your-username/output/contributions.svg)
![last 90 days](https://raw.githubusercontent.com/your-username/your-username/output/contributions-90d.svg)
```

#### `<picture>` で Light / Dark を強制

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://.../contributions.svg?theme=dark" />
  <img src="https://.../contributions.svg?theme=light" />
</picture>
```

`theme=auto`（デフォルト）は単一 SVG 内で Light / Dark を自動切替するため、通常はこの設定は不要です。

### 仕組み

1. GitHub GraphQL API (`contributionsCollection`) で contribution を取得
2. 種別ごと（Commits / PRs / Issues / Reviews）に日次集計
3. 手書きの SVG をレンダリング（JS ランタイム不要、`<style>` 埋め込み）
4. `output` ブランチに force-push（無ければ自動作成）
5. プロフィール README から `raw.githubusercontent.com` 経由で参照

Action は **あなた自身のリポジトリ** の Actions 環境で動くので、中央サーバー不要、共有レート制限なし、GitHub の CDN で高速配信。

## 🙏 クレジット

手書き風のデザインは [`star-history/star-history`](https://github.com/star-history/star-history) のチャートに着想を得ています。

## 🛸 ライセンス

MIT

---

Made with ❤️ for your GitHub story.
