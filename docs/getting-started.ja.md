# セットアップガイド

[English](getting-started.md) | 日本語

GitHub Actions を初めて使う方向けのステップバイステップガイドです。すでに workflow YAML や Secret 登録に慣れている方は、[README の GitHub Action セクション](../README.ja.md#-github-action)で十分です。

GitHub アカウントは持っているが **GitHub Actions は触ったことがない** 方を想定しています。所要時間: 約 10 分。

---

## 前提条件

- GitHub アカウント
- 5〜10 分の作業時間
- GitHub の Web UI でファイルを作成できる程度の知識（Git CLI 不要）

**不要なもの:**
- ローカルへの Node.js インストール
- Docker
- Personal Access Token（private contribution を含めたい場合のみ Step 3 で必要）

---

## Step 1. プロフィールリポジトリを用意

GitHub では、**ユーザー名と完全に同じ名前のリポジトリ** が「プロフィールリポジトリ」として特別扱いされ、その README がプロフィールページのトップに表示されます。

1. <https://github.com/new> を開く
2. **Repository name**: GitHub のユーザー名と同じ名前（例: ユーザー名が `pipipi-dev` ならリポジトリ名も `pipipi-dev`）
3. **Public** を選択（チャート画像を埋め込むには public が必須）
4. **Add a README file** にチェック
5. **Create repository** をクリック

すでにこのリポジトリがある場合は Step 2 へ。

> 💡 名前が正しいと「🎉 Special repository」というバナーが表示されます。

---

## Step 2. workflow ファイルを置く

workflow ファイルの置き場所は **`.github/workflows/<任意の名前>.yml`** とリポジトリのルート直下に固定されています。GitHub はこのディレクトリ内の YAML を自動で検出し、トリガーに従って実行します。

### 2a. GitHub の Web UI でファイルを作成

1. プロフィールリポジトリのページで **Add file** → **Create new file** をクリック
2. ファイル名欄に以下を**そのまま**入力：
   ```
   .github/workflows/contribution-chart.yml
   ```
   （`/` を含む名前を入力すると、自動的にフォルダが作成されます）
3. 以下を貼り付け：

```yaml
name: update contribution chart

on:
  schedule:
    - cron: "0 0 * * *"     # 毎日 00:00 UTC
  workflow_dispatch:         # Actions タブから手動実行可能にする
  push:
    branches: [main]         # main への push 時にも実行

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write        # 生成 SVG をコミットするのに必要
    steps:
      - uses: pipipi-dev/gcchart@v1
        with:
          outputs: |
            contributions.svg
```

4. ページ下部までスクロール → **Commit new file** をクリック

これで workflow が登録されました。

### 2b. パラメータはどこに書くのか

Action の入力パラメータ（[README の入力パラメータ表](../README.ja.md#入力パラメータ)に列挙されているもの）は、すべて **`with:`** ブロックの配下に書きます。たとえば 2 種類のチャートを生成する例：

```yaml
      - uses: pipipi-dev/gcchart@v1
        with:
          outputs: |                                          # ← outputs パラメータ
            contributions.svg
            contributions-90d.svg?period=90&granularity=day
          target_branch: output                               # ← 任意。デフォルト値を明示
          commit_message: "chore: update contribution chart"
```

デフォルト値があるパラメータ（必須以外すべて）は、まるごと省略可能です。

---

## Step 3.（任意）private contribution 用のトークンを設定

**public リポジトリの contribution だけで OK ならこの Step はスキップ可能** です。デフォルトの `${{ github.token }}` で十分です。

**private リポジトリの Commits / PRs / Issues も含めたい** 場合は、`repo` スコープを持つ Personal Access Token (PAT) が必要です。

### 3a. PAT を作成

1. <https://github.com/settings/tokens> を開く
2. **Generate new token** → **Generate new token (classic)** をクリック
3. **Note**: `contribution-chart` など、何用か分かる名前を付ける
4. **Expiration**: 有効期限を選択（90日、1年など。期限切れ時は再発行が必要）
5. **Scopes**: `repo` にチェック（クリックすると配下の項目すべてに自動でチェックが入る）
6. ページ下部の **Generate token** をクリック
7. 表示された `ghp_...` 文字列を **その場で必ずコピー** - このページを離れると GitHub も二度と表示しません

### 3b. PAT を Secret として登録

PAT を workflow ファイルに直接書くと、コミット履歴として **永久に GitHub 上に残ってしまいます**。代わりに「Secret」として登録します。GitHub が暗号化して保管し、workflow 実行時にだけ復号して渡してくれます。

1. プロフィールリポジトリの **Settings** タブを開く
2. 左サイドバー: **Secrets and variables** → **Actions**
3. **New repository secret** をクリック
4. **Name**: `GH_PAT`（任意の名前で OK ですが、**`GITHUB_` で始まる名前は予約済み** で使えません）
5. **Secret**: 3a-7 でコピーした `ghp_...` を貼り付け
6. **Add secret** をクリック

### 3c. workflow から Secret を参照

`.github/workflows/contribution-chart.yml` を編集し、`github_token` の行を追加：

```yaml
      - uses: pipipi-dev/gcchart@v1
        with:
          github_token: ${{ secrets.GH_PAT }}   # ← 3b-4 で付けた Secret 名を参照
          outputs: |
            contributions.svg
```

`${{ secrets.GH_PAT }}` は実行時に Secret の中身（PAT 本体）に展開され、ログ出力時には自動で `***` にマスクされます。

### 3d. 「Include private contributions on my profile」を ON にする

GitHub にはプロフィール側にも「private 活動を API 経由で公開するか」のトグルがあります：

1. <https://github.com/settings/profile> を開く
2. **Contributions & Activity** までスクロール
3. **Include private contributions on my profile** にチェック
4. **Save**

これが OFF だと、`repo` スコープ付き PAT を使っても private contribution はゼロで返ってきます。

---

## Step 4. 手動で workflow を実行

設定した workflow は 1 日 1 回 cron で自動実行されますが、初回確認まで待つのは辛いので手動で実行します：

1. プロフィールリポジトリを GitHub で開く
2. ページ上部の **Actions** タブをクリック
3. 左サイドバーで **update contribution chart**（YAML の `name:` で指定した名前）をクリック
4. 右側に **"This workflow has a workflow_dispatch event trigger."** というバナーが出ます。**Run workflow** → 緑色の **Run workflow** ボタンをクリック
5. 5 秒ほどしてページをリロードすると、黄色 ⏳ アイコンの新しい実行が出ます
6. クリックすると進捗が見られ、各 step の名前を展開するとログが見られます

所要時間: contribution の量に応じて **30 秒〜2 分**。

成功すると、すべての項目が緑 ✅ になります。

---

## Step 5. プロフィール README にチャートを埋め込む

workflow が成功すると、`output` という新しいブランチ（`main` とは別）に `contributions.svg` がコミットされています。リポジトリページのブランチ切り替えドロップダウンを `main` から `output` に切り替えれば確認できます。

プロフィールに表示するには、**`main` ブランチ**の `README.md` を編集して以下を追加：

```markdown
![contributions](https://raw.githubusercontent.com/your-username/your-username/output/contributions.svg)
```

`your-username` 部分（**2 ヶ所**）を自分の GitHub ユーザー名に置き換えてコミット。

`https://github.com/your-username` を開けば、プロフィール上部にチャートが表示されているはずです。

---

## トラブルシューティング

### Actions タブが空 / "No workflows" 表示
YAML ファイルの場所が間違っています。**デフォルトブランチ（通常は `main`）の** `.github/workflows/<name>.yml` に正確に配置されている必要があります。GitHub 上でパスを確認してください。

### workflow が実行されたが "Resource not accessible by integration" で失敗
`permissions: contents: write` の行が抜けているか、スペルミスです。生成 SVG をコミットするための書き込み権限が必要です。

### チャートは出るが private contribution が反映されない
以下の 3 つすべてが揃っている必要があります：
1. PAT に `repo` スコープがある（`read:user` だけでは不足）
2. PAT が Secret として正しく登録され、`${{ secrets.NAME }}` で参照されている
3. **Include private contributions on my profile** が ON になっている（Step 3d）

### プロフィール README で画像が表示されない
- URL の確認: `raw.githubusercontent.com/your-username/your-username/output/contributions.svg` の `your-username` 部分が **実際のユーザー名** に置き換わっていますか？
- `output` ブランチが存在し、`contributions.svg` が含まれているか（ブランチ切り替えで確認）
- GitHub は Camo 経由で画像をキャッシュ（〜5 分）するため、push 直後は少し待つ

### Action ログに "Bad credentials" エラー
PAT の有効期限が切れています。新しい PAT を作成（Step 3a）して、Secret の値を更新してください（Settings → Secrets and variables → Actions → `GH_PAT` をクリック → **Update**）。

### cron がスケジュール通りに動かない
GitHub は無料枠リポジトリで活動量が少ない場合、cron トリガーを遅延・スキップすることがあります。`push` トリガーをバックアップに使うか、必要時に `workflow_dispatch` で手動実行してください。

---

## 次のステップ

- [チャートのカスタマイズ](../README.ja.md#出力ファイルのクエリ文字列オプション) - 期間、スタイル、テーマ、集約粒度の変更
- [複数バリエーションの埋め込み](../README.ja.md#90-日と-365-日の両方を埋め込む) - 例: 90日日次と 1年週次の両方
- [`<picture>` で Light / Dark を強制](../README.ja.md#picture-で-light--dark-を強制) - viewer の OS ではなく GitHub のテーマ設定に追従

それでも解決しない場合は、[issue を作成](https://github.com/pipipi-dev/gcchart/issues) してください。以下の情報があると助かります：
- 該当する workflow YAML の抜粋（Secret は伏せてください）
- 失敗した Action 実行へのリンク
- 期待した挙動と実際の挙動
