# PRD：お絵描きの森

## 概要

リアルタイムお絵描き当てゲーム。1人が絵を描き、他のプレイヤーがお題を当てるWebアプリ。

---

## ゲームルール

- **1ゲーム：** 5分
- **1ターン：** 最大30秒（正解が出たら即終了）
- **プレイ人数：** 3〜6名
- **絵描き役：** 1名（全員をローテーション・繰り返し）
- **回答者：** それ以外の全員（リアルタイムで回答入力）
- **ポイント：** そのターンで最初に正解した1人が獲得
- **お題：** 開発者側で事前に用意したリストからランダム出題
- **正解が出たら：** 即座にターン終了 → 次の絵描き役に交代 → 新しいお題が設定される

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
takebayashi-game/
├── client/                        # フロントエンド（React + Vite）
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.jsx         # お絵描きキャンバス
│   │   │   ├── Chat.jsx           # 回答チャット欄
│   │   │   ├── Timer.jsx          # タイマー
│   │   │   ├── Scoreboard.jsx     # スコア表示
│   │   │   └── PlayerList.jsx     # プレイヤー一覧
│   │   ├── pages/
│   │   │   ├── Login.jsx          # ログイン画面
│   │   │   ├── Register.jsx       # ユーザー登録画面
│   │   │   ├── Lobby.jsx          # ロビー画面
│   │   │   └── Game.jsx           # ゲーム画面
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js    # WebSocket接続管理
│   │   │   └── useGame.js         # ゲーム状態管理
│   │   ├── context/
│   │   │   └── AuthContext.jsx    # ログイン状態管理
│   │   ├── utils/
│   │   └── App.jsx
│   ├── index.html
│   └── vite.config.js
│
├── server/                        # バックエンド（Node.js + Express）
│   ├── controllers/
│   │   ├── authController.js      # 登録・ログイン
│   │   └── roomController.js      # ルーム管理
│   ├── routes/
│   │   ├── auth.js
│   │   └── room.js
│   ├── websocket/
│   │   ├── wsServer.js            # WebSocket接続管理
│   │   └── gameManager.js         # ゲーム進行ロジック
│   ├── models/
│   │   ├── user.js
│   │   └── room.js
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT認証チェック
│   ├── db/
│   │   └── index.js               # DB接続設定
│   ├── data/
│   │   └── topics.js              # お題リスト
│   └── index.js                   # エントリーポイント
│
├── .env                           # 環境変数
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

> フェーズ2で追加予定：`game_histories`、`scores`（累計スコア・ゲーム履歴）

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
| `game:start` | ホスト→サーバー | ゲーム開始 |
| `game:turn_start` | サーバー→全員 | ターン開始・絵描き役とお題を通知（回答者にはお題を隠す） |
| `game:turn_end` | サーバー→全員 | ターン終了（時間切れ or 正解） |
| `game:end` | サーバー→全員 | ゲーム終了・最終スコア通知 |
| `game:tick` | サーバー→全員 | 残り時間を毎秒通知 |

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
| ロビー | `/lobby` | ルーム作成・部屋番号で参加 |
| ゲーム | `/room/:roomCode` | ゲーム本体 |

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
- 累計スコア・ゲーム履歴の保存
- プロフィール画面
- SNSログイン（Google等）
