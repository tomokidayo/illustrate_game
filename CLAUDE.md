# PRD：お絵描きの森

## 概要

リアルタイムお絵描き当てゲーム。1人が絵を描き、他のプレイヤーがお題を当てるWebアプリ。

---

## ゲームルール

### ノーマルモード

- **1ゲーム：** 5分
- **1ターン：** 最大30秒（正解が出たら即終了）
- **プレイ人数：** 3〜6名
- **絵描き役：** 1名（全員をローテーション・繰り返し）
- **回答者：** それ以外の全員（リアルタイムで回答入力）
- **ポイント：** 正解した回答者 +3pt、その絵描き役 +2pt、時間切れ時は絵描き役 -2pt
- **お題：** 開発者側で事前に用意したリストからランダム出題（ゲーム内重複なし）
- **正解が出たら：** 即座にターン終了 → 次の絵描き役に交代 → 新しいお題が設定される

### 人狼モード

- ランダムで1人が **人狼**、他は **市民** に割り当てられる（役割は非公開）
- ゲーム中のポイント制はなく、**連続正解数**（ストリーク）でのみ勝敗を競う
- **市民の勝利条件①：** 5連続正解（ジャッジメントなし即勝利）
- **市民の勝利条件②：** ゲーム終了後のジャッジメントタイム（30秒）で人狼を多数決で特定
- **人狼の勝利条件：** 投票で特定されない、または5連続正解を阻止してジャッジメントを生き残る

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + Vite + TypeScript |
| バックエンド | Node.js + Express + TypeScript |
| リアルタイム通信 | WebSocket（`ws`ライブラリ） |
| データベース | PostgreSQL |
| 認証 | JWT |

---

## ディレクトリ構成

```
illust_game/
├── client/                        # フロントエンド（React + Vite）
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.tsx         # お絵描きキャンバス
│   │   │   ├── Chat.tsx           # 回答チャット欄
│   │   │   ├── Timer.tsx          # タイマー
│   │   │   ├── Scoreboard.tsx     # スコア表示
│   │   │   └── ProtectedRoute.tsx # 認証ガード
│   │   ├── pages/
│   │   │   ├── Login.tsx          # ログイン画面
│   │   │   ├── Register.tsx       # ユーザー登録画面
│   │   │   ├── Lobby.tsx          # ロビー画面（ゲーム履歴表示含む）
│   │   │   ├── Game.tsx           # ゲーム画面
│   │   │   └── Rules.tsx          # ルール説明画面
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts    # WebSocket接続管理
│   │   │   └── useGame.ts         # ゲーム状態管理
│   │   ├── context/
│   │   │   └── AuthContext.tsx    # ログイン状態管理
│   │   ├── utils/
│   │   │   └── api.ts             # REST APIクライアント
│   │   └── App.tsx
│   ├── index.html
│   └── vite.config.ts
│
├── server/                        # バックエンド（Node.js + Express）
│   ├── controllers/
│   │   ├── authController.ts      # 登録・ログイン
│   │   ├── roomController.ts      # ルーム管理
│   │   └── gameHistoryController.ts # ゲーム履歴取得
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── room.ts
│   │   └── gameHistory.ts
│   ├── websocket/
│   │   ├── wsServer.ts            # WebSocket接続管理（JWT認証付き）
│   │   └── gameManager.ts         # ゲーム進行ロジック
│   ├── middleware/
│   │   └── authMiddleware.ts      # JWT認証チェック
│   ├── db/
│   │   └── index.ts               # DB接続設定
│   ├── data/
│   │   └── topics.ts              # お題リスト（約70件）
│   └── index.ts                   # エントリーポイント
│
├── .env                           # 環境変数
├── Procfile                       # デプロイ設定
└── package.json
```

---

## DB設計

### users
| カラム名 | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| username | VARCHAR | ユーザー名（一意） |
| password_hash | VARCHAR | ハッシュ化パスワード |
| created_at | TIMESTAMP | 登録日時 |

### rooms
| カラム名 | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| room_code | VARCHAR | 部屋番号（例：ABC123） |
| host_user_id | UUID | 作成者のユーザーID |
| status | VARCHAR | `waiting` / `playing` / `finished` |
| created_at | TIMESTAMP | 作成日時 |

### room_players
| カラム名 | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| room_id | UUID | ルームID |
| user_id | UUID | ユーザーID |
| joined_at | TIMESTAMP | 参加日時 |

### token_blacklist
| カラム名 | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| token | TEXT | 無効化されたトークン |
| expired_at | TIMESTAMP | トークンの有効期限 |
| created_at | TIMESTAMP | ブラックリスト登録日時 |

### game_histories
| カラム名 | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| room_id | UUID | ルームID |
| user_id | UUID | ユーザーID |
| score | INTEGER | 最終スコア |
| rank | INTEGER | 順位 |
| played_at | TIMESTAMP | プレイ日時 |

---

## API設計

### 認証系

| メソッド | エンドポイント | 説明 |
|---|---|---|
| POST | `/api/auth/register` | ユーザー登録 |
| POST | `/api/auth/login` | ログイン・JWT発行 |
| POST | `/api/auth/logout` | ログアウト・トークン無効化 |
| GET | `/api/auth/me` | ログイン中のユーザー情報取得 |

### ルーム系（JWT認証必須）

| メソッド | エンドポイント | 説明 |
|---|---|---|
| POST | `/api/rooms` | ルーム作成 |
| GET | `/api/rooms/:roomCode` | ルーム情報取得 |
| POST | `/api/rooms/:roomCode/join` | ルーム参加 |
| POST | `/api/rooms/:roomCode/leave` | ルーム退出 |

### ゲーム履歴系（JWT認証必須）

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/api/game-histories` | ログインユーザーのゲーム履歴取得 |

---

## WebSocketイベント設計

### 接続・ルーム系

| イベント名 | 送信元 | 内容 |
|---|---|---|
| `room:join` | クライアント→サーバー | ルームに接続 |
| `room:leave` | クライアント→サーバー | ルームから切断 |
| `room:players_updated` | サーバー→全員 | プレイヤー一覧の更新 |

### ゲーム進行系

| イベント名 | 送信元 | 内容 |
|---|---|---|
| `game:start` | ホスト→サーバー | ゲーム開始（`mode: 'normal' \| 'werewolf'` を含む） |
| `game:turn_start` | サーバー→全員 | ターン開始・絵描き役とお題を通知（回答者にはお題を隠す） |
| `game:turn_end` | サーバー→全員 | ターン終了（時間切れ or 正解） |
| `game:end` | サーバー→全員 | ノーマルモード終了・最終スコア通知 |
| `game:tick` | サーバー→全員 | 残り時間を毎秒通知 |
| `game:abort` | 誰でも→サーバー→全員 | ゲーム中断・waiting状態に戻る |

### 人狼モード系

| イベント名 | 送信元 | 内容 |
|---|---|---|
| `werewolf:role` | サーバー→各自 | 自分の役割通知（`'citizen' \| 'werewolf'`） |
| `game:werewolf_end` | サーバー→全員 | 5連続正解による市民勝利（ジャッジメントなし） |
| `judgment:start` | サーバー→全員 | ジャッジメントタイム開始（投票対象プレイヤー一覧） |
| `judgment:vote` | クライアント→サーバー | 投票送信（`targetUserId`） |
| `judgment:voted` | サーバー→全員 | 投票受付通知（票数更新） |
| `judgment:result` | サーバー→全員 | 投票結果・人狼公開・勝敗通知 |

### キャンバス系

| イベント名 | 送信元 | 内容 |
|---|---|---|
| `canvas:draw` | 絵描き→サーバー→全員 | 描画データ（座標・色・太さ） |
| `canvas:clear` | 絵描き→サーバー→全員 | キャンバスをクリア |

### 回答系

| イベント名 | 送信元 | 内容 |
|---|---|---|
| `answer:submit` | 回答者→サーバー | 回答を送信 |
| `answer:correct` | サーバー→全員 | 正解通知・ポイント付与 |
| `answer:wrong` | サーバー→全員 | 不正解の回答をチャットに表示 |

---

## 画面設計

### ページ一覧

| ページ | URL | 説明 |
|---|---|---|
| ログイン | `/login` | ユーザー名・パスワードでログイン |
| ユーザー登録 | `/register` | 新規アカウント作成 |
| ロビー | `/lobby` | ルーム作成・部屋番号で参加・ゲーム履歴表示 |
| ゲーム | `/room/:roomCode` | ゲーム本体 |
| ルール説明 | `/rules` | ノーマルモード・人狼モードのルール説明 |

### 画面遷移フロー

```
未ログイン
  └→ /login or /register
        └→ ログイン成功
              └→ /lobby
                    ├→ ルーム作成 → /room/:roomCode
                    └→ 部屋番号入力して参加 → /room/:roomCode
```

### ゲーム画面レイアウト

```
┌─────────────────────────────────┐
│  残り時間：28秒    ターン：2/6   │
├──────────────────┬──────────────┤
│                  │ プレイヤー   │
│                  │ ・田中 10pt  │
│   キャンバス     │ ・山田  5pt  │
│                  │ ・佐藤  0pt  │
│                  ├──────────────┤
│                  │ チャット     │
│                  │ 山田：犬？   │
│                  │ ✅佐藤が正解 │
├──────────────────┴──────────────┤
│  回答入力欄         [送信]       │
└─────────────────────────────────┘
```

---

## 開発ルール

### リポジトリ

https://github.com/tomokidayo/illustrate_game.git

### Gitブランチ運用

- `main` ブランチを常にデプロイ可能な状態に保つ
- 各featureブランチは `main` から作成する
- 動作確認後に `main` へマージする
- **環境構築・設定変更を含む全ての作業でブランチを切る（mainへの直接コミット禁止）**

### コミットメッセージ規則

プレフィックスを必ずつける：

| プレフィックス | 用途 |
|---|---|
| `feat:` | 新機能の追加 |
| `fix:` | バグ修正 |
| `chore:` | 設定変更・リファクタリングなど |

**例：**
```
feat: ユーザー登録APIを実装
fix: タイマーがターン終了後もカウントし続けるバグを修正
chore: ESLint設定を追加
```

### プルリクエスト・レビュー規則

- プルリクエスト作成時は **実装者** として記載する
- レビューコメント記載時は **レビュワー** として記載する

---

## 将来対応（フェーズ2）

- メールによるパスワード再設定機能
- プロフィール画面
- SNSログイン（Google等）
- ネットワーク切断時の自動再接続
- サーバー再起動後のゲーム状態復元（現状はインメモリのみ）
