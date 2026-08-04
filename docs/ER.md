# ER図 — お絵描きの森

```mermaid
erDiagram
    users {
        UUID id PK
        VARCHAR username UK "2〜20文字、英数字・アンダースコア"
        VARCHAR password_hash
        VARCHAR email UK "NULL可"
        VARCHAR avatar "絵文字など、NULL可"
        TIMESTAMP created_at
    }

    rooms {
        UUID id PK
        VARCHAR room_code UK "6文字英数字"
        UUID host_user_id FK "NULL可（ゲスト作成ルーム）"
        VARCHAR status "waiting / playing / finished"
        TIMESTAMP created_at
    }

    room_players {
        UUID id PK
        UUID room_id FK
        UUID user_id FK
        TIMESTAMP joined_at
    }

    token_blacklist {
        UUID id PK
        TEXT token "ログアウト済みJWT"
        TIMESTAMP expired_at
        TIMESTAMP created_at
    }

    game_histories {
        UUID id PK
        UUID room_id FK "NULL可（ルーム削除後も保持）"
        VARCHAR room_code "ルーム削除後の参照用"
        VARCHAR mode "normal / werewolf / duo"
        INTEGER best_streak "人狼・デュオの最大連続正解数"
        INTEGER duo_level "デュオ: 1〜4、通常は NULL"
        TIMESTAMP played_at
    }

    game_scores {
        UUID id PK
        UUID game_id FK
        UUID user_id FK "NULL可（ユーザー削除後も保持）"
        VARCHAR username "削除後も名前を残すために非正規化"
        INTEGER score
        INTEGER rank
    }

    friendships {
        UUID id PK
        UUID requester_id FK
        UUID receiver_id FK
        VARCHAR status "pending / accepted / rejected"
        TIMESTAMP created_at
    }

    users ||--o{ rooms          : "host（NULL可）"
    users ||--o{ room_players   : "参加"
    users ||--o{ game_scores    : "スコア記録（NULL可）"
    users ||--o{ friendships    : "申請"
    users ||--o{ friendships    : "受信"
    rooms ||--o{ room_players   : "メンバー"
    rooms ||--o{ game_histories : "ゲーム履歴（NULL可）"
    game_histories ||--o{ game_scores : "プレイヤースコア"
```

## テーブル概要

| テーブル | 役割 |
|---|---|
| `users` | 登録ユーザー。ゲストは DB に保存されない（JWT のみ） |
| `rooms` | ゲームルーム。ゲスト作成時は `host_user_id = NULL` |
| `room_players` | ルームへの参加登録（登録ユーザーのみ）。`(room_id, user_id)` 複合 UNIQUE |
| `token_blacklist` | ログアウト済み JWT を保存し二重利用を防ぐ |
| `game_histories` | ゲーム1回分のメタ情報。`room_id` は `SET NULL`（ルーム削除後も履歴保持） |
| `game_scores` | ゲームごとの個人スコア・順位。`user_id` は `SET NULL`（ユーザー削除後も名前は保持） |
| `friendships` | フレンド申請・承認状態。`(requester_id, receiver_id)` 複合 UNIQUE |

## 主な設計ポイント

- **ゲストユーザーは DB に存在しない** — JWT ペイロード（`isGuest: true`, `id: "guest_*"`）のみで識別
- **ゲスト作成ルームは `host_user_id = NULL`** — WS 接続時に最初に join したユーザーをホストとして扱う
- **履歴の非正規化** — `game_scores.username` を保持することで、ユーザー退会後も対戦履歴を表示可能
- **インデックス** — `token_blacklist(token)`、`game_scores(user_id)`、`game_scores(game_id)`、`friendships(requester_id)`、`friendships(receiver_id)`
