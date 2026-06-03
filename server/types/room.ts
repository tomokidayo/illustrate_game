/** ルームのステータス */
export type RoomStatus = 'waiting' | 'playing' | 'finished';

/** rooms テーブルの1行を表す型 */
export interface Room {
  /** UUID主キー */
  id: string;
  /** 6文字の英数字ルームコード */
  room_code: string;
  /** ルームを作成したユーザーのID */
  host_user_id: string;
  /** ルームの現在のステータス */
  status: RoomStatus;
  /** 作成日時 */
  created_at: Date;
}

/** room_players テーブルの1行を表す型 */
export interface RoomPlayer {
  /** UUID主キー */
  id: string;
  /** 所属するルームのID */
  room_id: string;
  /** プレイヤーのユーザーID */
  user_id: string;
  /** 参加日時 */
  joined_at: Date;
}
