import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

/** ゲーム履歴の1件分 */
interface GameHistoryEntry {
  id: string;
  room_code: string;
  played_at: string;
  score: number;
  rank: number;
  player_count: number;
}

/**
 * ロビー画面コンポーネント
 * @description ルームの作成・参加・ログアウトを行うページ
 */
export default function Lobby() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [histories, setHistories] = useState<GameHistoryEntry[]>([]);

  useEffect(() => {
    api.get<GameHistoryEntry[]>('/api/game-histories')
      .then(res => setHistories(res.data))
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    setError('');
    setCreating(true);
    try {
      const { data } = await api.post<{ room_code: string }>('/api/rooms');
      navigate(`/room/${data.room_code}`);
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.error ?? 'ルーム作成に失敗しました' : 'ルーム作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) { setError('ルームコードを入力してください'); return; }
    setError('');
    setJoining(true);
    try {
      await api.post(`/api/rooms/${code}/join`);
      navigate(`/room/${code}`);
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.error ?? 'ルームへの参加に失敗しました' : 'ルームへの参加に失敗しました');
    } finally {
      setJoining(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <header>
        <span>{user?.username}</span>
        <button type="button" onClick={handleLogout}>ログアウト</button>
      </header>
      <main>
        <h1>ロビー</h1>
        {error && <p role="alert">{error}</p>}
        <section>
          <h2>ルームを作成</h2>
          <button type="button" onClick={handleCreate} disabled={creating}>
            {creating ? '作成中...' : 'ルームを作成'}
          </button>
        </section>
        <section>
          <h2>ルームに参加</h2>
          <form onSubmit={handleJoin}>
            <label htmlFor="joinCode">ルームコード</label>
            <input
              id="joinCode"
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              placeholder="XXXXXX"
              maxLength={6}
            />
            <button type="submit" disabled={joining}>
              {joining ? '参加中...' : '参加する'}
            </button>
          </form>
        </section>
        <section>
          <h2>最近のゲーム</h2>
          {histories.length === 0 ? (
            <p>まだゲームの記録がありません</p>
          ) : (
            <ul>
              {histories.map(h => (
                <li key={h.id}>
                  <span>{h.room_code}</span>
                  <span>{h.rank}位 / {h.player_count}人中</span>
                  <span>{h.score}pt</span>
                  <span>{new Date(h.played_at).toLocaleDateString('ja-JP')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
