# Network Room Lab

情報ネットワークを「役割を切り替えて動かす」体験型Webアプリケーションです。一人なら6つの機器を順番に、授業では仲間と役割分担して、Webページが表示されるまでの通信と障害診断を体験できます。

`Network_Room_Lab_設計書_v0.9.docx` をもとに、Cloudflare Workers、Static Assets、SQLite-backed Durable Objects、WebSocket Hibernationを使って実装しています。

## 主な機能

- 6文字の部屋コードによる授業ルーム作成・参加
- 部屋コード不要で全6役を順番に体験できる、自己ペースのひとり学習モード
- PC、無線AP、L2スイッチ、ルータ、DNS、Webサーバを「見る→選ぶ→確かめる」の1画面1行動で順番に体験する初学者向け役割ラボ
- 値ごとのやさしい意味、身近な例、任意ヒント、説明の書き出し支援、教室内での説明共有
- IP・プレフィックス・MAC・MACアドレス表・経路表・DNSレコード・HTTP要求の「値の見方」と確認手順
- `easy_Packet`の教材要素を統合した模擬ターミナル（ipconfig、arp、nslookup、ping、traceroute、HTTPS）
- 「予想→コマンド実行→結果の観察→自分の言葉で説明」を繰り返す実践ワークベンチ
- 同じ部屋の学習者が説明を共有し、着目点の違いを読み比べられる「みんなの説明」
- 操作中にその場で開ける、具体例付きのやさしいネットワーク用語集
- 6つの機器役割の自動割り当てと教員による再割り当て
- 入室、役割確認、機器構成、IP設定、通信実験、障害診断、振り返りの7フェーズ
- ARP、DNS、TCP、TLS、HTTPSを17ステップで進めるプロトコル実験
- レイヤ別パケット表示、TTL、担当者別の観察範囲
- 回線断、DNS停止、GW誤設定、証明書エラーなど7種類の障害注入
- ping、nslookup、traceroute、HTTPS確認による診断
- リアルタイムの参加状況、教員メッセージ、イベント履歴
- 振り返り回答と授業記録のCSV／JSON出力
- 教員・参加者トークン、役割・フェーズ別権限、入力検証
- 初学者向けの手順ガイド、用語説明、やり直しやすい操作設計
- Tailwind CSSとDodgerBlue（`#1E90FF`）を基調にしたレスポンシブUI

## 構成

```text
React + Vite + Tailwind CSS (Static Assets)
          │ REST / WebSocket
Cloudflare Worker
          │ room code → Durable Object
RoomDurableObject (SQLite + WebSocket Hibernation)
```

部屋ごとに1つの Durable Object を使用し、参加者、状態、イベント、共有説明、振り返り、スナップショットをSQLiteへ保存します。WebSocket接続が休止している間も接続情報を保持できるため、教室内のリアルタイム更新を低コストで継続できます。

## 必要環境

- Node.js 20.19以上、または22.12以上
- pnpm 10以上
- Cloudflareへデプロイする場合はWranglerでログイン済みであること

## 開発

```bash
pnpm install
pnpm dev
```

`pnpm dev` はフロントエンドをビルドしてからWorkerを起動します。表示されたローカルURLをブラウザで開いてください。画面だけをViteで開発する場合は `pnpm dev:ui` を使えますが、APIは別途Workerを起動する必要があります。

## 検証

```bash
pnpm check
pnpm deploy:dry
```

`pnpm check` はTypeScript、Cloudflareバインディング型、ドメインロジック、Worker／Durable Object統合テストを実行します。`pnpm deploy:dry` は本番用アセットのビルドとWranglerのドライランを行います。

## デプロイ

```bash
pnpm deploy
```

初回デプロイでは `wrangler.jsonc` のマイグレーションによりSQLite-backed Durable Objectクラスが作成されます。秘密情報の事前登録は不要です。部屋データは作成から30日後を有効期限として記録します。

## API

| メソッド | パス | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | ヘルスチェック |
| `POST` | `/api/rooms` | 部屋作成 |
| `POST` | `/api/rooms/:code/join` | 学習者の参加 |
| `GET` | `/api/rooms/:code/snapshot` | 最新状態の取得 |
| `GET` | `/api/rooms/:code/events?after=N` | 差分イベント取得 |
| `POST` | `/api/rooms/:code/actions` | 授業操作の実行 |
| `GET` | `/api/rooms/:code/socket` | リアルタイム接続 |
| `GET` | `/api/rooms/:code/export` | CSV出力（`?format=json` でJSON） |

認証が必要なREST APIには `Authorization: Bearer <token>` を指定します。ブラウザ版ではトークンをURLへ含めず、端末の `localStorage` に保存します。

## 実装上の前提

- IPアドレス、経路、診断結果は授業用のモデルであり、実ネットワークへのパケット送信は行いません。
- 部屋コードは共有用識別子で、権限は教員・参加者ごとの推測困難なトークンで判定します。
- 学習者には注入した障害名を明かさず、観測できる症状のみを表示します。
- 本番運用ではCloudflareのログ保持、データ保持、アクセス方針を学校の規程に合わせて設定してください。
