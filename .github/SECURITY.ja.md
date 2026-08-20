# セキュリティポリシー

[English](SECURITY.md) | 日本語

## 脆弱性の報告

gcchart に関する脆弱性を発見した場合は、**public な issue を作成しないでください**。代わりに、本リポジトリの Security タブから GitHub の [private vulnerability reporting](https://docs.github.com/ja/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) 機能を使って非公開で報告してください。

報告時には以下を含めていただけると助かります：

- 脆弱性の内容と影響範囲
- 再現手順
- テストしたバージョン（リリースタグまたはコミット SHA）
- 既知の緩和策があれば、その内容

数日以内に確認の連絡をお返しします。修正はパッチバージョンとしてリリースされ、影響を受けたバージョンは公開アドバイザリに記載されます。

## トークンの取り扱い

このアクションは、以下の用途で GitHub トークン（デフォルト: `${{ github.token }}`）を要求します：

1. GraphQL API を介した contribution データの取得
2. 生成した SVG の `output` ブランチへのコミット

トークンは、push 時に使用する一時クローンディレクトリ以外では **ディスクに書き込まれません**。また、エラーメッセージから **自動的に redact** された上で再 throw されます。ただし、一時 git config の remote URL には含まれます - このディレクトリはアクション実行中のみ存在し、自動的にクリーンアップされます。

private contribution を含めるなどで Personal Access Token を渡す場合は、用途に必要な **最小権限のスコープ** を選んでください：

- `read:user` - public な contribution のみ
- `repo` - private な contribution をチャートに含める場合のみ必要
