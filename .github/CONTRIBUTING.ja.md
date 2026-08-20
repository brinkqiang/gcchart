# コントリビュートガイド

[English](CONTRIBUTING.md) | 日本語

ご興味をお寄せいただきありがとうございます。バグ報告・機能提案・プルリクエスト、いずれも歓迎です。

## バグ報告 / 機能提案

issue を作成して、以下を含めてください：

- 起きた現象と期待していた挙動の簡潔な説明
- 再現手順（workflow YAML 抜粋、CLI コマンドなど）
- 見た目の問題の場合: サンプルの SVG / PNG と、使用したバリエーションのクエリ文字列

## ローカル開発

```bash
git clone https://github.com/pipipi-dev/gcchart.git
cd gcchart
npm install

# 自分の GitHub データで CLI を実行
GITHUB_TOKEN=ghp_xxx GITHUB_USER=your-username npm run fetch

# sample/ の合成サンプルを再生成
npm run sample

# 型チェック / ビルド
npm run lint
npm run build
```

## プルリクエスト

- 変更は焦点を絞って、1 つの関心ごとにつき 1 PR
- レンダリングコードを変更した場合は `npm run sample` を実行し、更新された `sample/` の SVG をコミットしてください（README の hero 画像はここから読み込まれています）
- `CHANGELOG.md` を `## [Unreleased]` 見出しの下に更新
- `npm run lint` と `npm run build` がパスすることを確認

## プロジェクト構成

| パス | 役割 |
|---|---|
| `src/cli.ts` | CLI エントリ - `npx gcchart` から呼ばれる |
| `src/action.ts` | Action エントリ - GitHub Action ランタイムから呼ばれる |
| `src/svg/` | SVG レンダラ（`sketchy.ts` / `clean.ts`）と共有ヘルパー |
| `src/share/` | 対話的な「Share on X」フロー（PNG 変換、クリップボード、ブラウザ起動）|
| `src/preview.ts` | バリエーション定義 + プレビュー HTML 生成（CLI と sample スクリプト両方が使用）|
| `scripts/sample.ts` | 合成データのサンプルジェネレータ（`sample/` に書き出し）|
| `docs/` | GitHub Actions が初めての方向けセットアップガイド |

## リリース

タグ付きリリースが npm パッケージと GitHub Marketplace 掲載の両方を駆動します：

```bash
git tag v1.0.0 && git push origin v1.0.0
git tag -f v1  && git push -f origin v1   # メジャーバージョンのエイリアス
npm publish
```
