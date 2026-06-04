import { Request, Response } from 'express';
import pool from '../db';

/** ゲーム履歴の1件分 */
interface GameHistoryRow {
  id: string;
  room_code: string;
  played_at: Date;
  score: number;
  rank: number;
  player_count: number;
}

/**
 * ログインユーザーの直近10件のゲーム履歴を返す
 */
export async function getGameHistories(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { rows } = await pool.query<GameHistoryRow>(
    `SELECT
       gh.id,
       gh.room_code,
       gh.played_at,
       gs.score,
       gs.rank,
       (SELECT COUNT(*)::INTEGER FROM game_scores WHERE game_id = gh.id) AS player_count
     FROM game_histories gh
     JOIN game_scores gs ON gs.game_id = gh.id AND gs.user_id = $1
     ORDER BY gh.played_at DESC
     LIMIT 10`,
    [userId]
  );
  res.json(rows);
}
