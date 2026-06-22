import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.get<GameHistoryEntry[]>('/api/game-histories')
      .then(res => setHistories(res.data))
      .catch(err => console.error('Failed to fetch game histories:', err));
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
    <div className="lobby-layout">
      <header className="lobby-header">
        <div className="lobby-header-logo">🌲 お絵描きの森</div>

        {/* デスクトップ用ナビ */}
        <div className="lobby-header-user">
          {user?.avatar && <span className="lobby-user-avatar">{user.avatar}</span>}
          <span>{user?.username}</span>
          <Link className="btn btn-ghost btn-sm" to="/profile">マイページ</Link>
          <Link className="btn btn-ghost btn-sm" to="/rules">ルール</Link>
          <button className="btn btn-ghost btn-sm" type="button" onClick={handleLogout}>ログアウト</button>
        </div>

        {/* モバイル用ハンバーガー */}
        <button
          className="lobby-hamburger"
          type="button"
          aria-label="メニューを開く"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(prev => !prev)}
        >
          <span className="lobby-hamburger-icon" aria-hidden="true">
            {menuOpen ? '✕' : '☰'}
          </span>
        </button>

        {/* モバイル用ドロップダウン */}
        {menuOpen && (
          <>
            <div className="lobby-menu-overlay" onClick={() => setMenuOpen(false)} />
            <nav className="lobby-menu-dropdown">
              <div className="lobby-menu-user">
                {user?.avatar && <span className="lobby-user-avatar">{user.avatar}</span>}
                <span className="lobby-menu-username">{user?.username}</span>
              </div>
              <Link
                className="lobby-menu-item"
                to="/profile"
                onClick={() => setMenuOpen(false)}
              >
                マイページ
              </Link>
              <Link
                className="lobby-menu-item"
                to="/rules"
                onClick={() => setMenuOpen(false)}
              >
                ルール
              </Link>
              <button
                className="lobby-menu-item lobby-menu-item--danger"
                type="button"
                onClick={() => { setMenuOpen(false); handleLogout(); }}
              >
                ログアウト
              </button>
            </nav>
          </>
        )}
      </header>
      <main className="lobby-main">
        {error && <p className="error-msg" role="alert">{error}</p>}
        <div className="lobby-grid">
          <div className="lobby-card">
            <div className="lobby-card-title">🎨 ルームを作成</div>
            <p className="lobby-card-desc">新しいゲームルームを作成して、友達を招待しましょう。</p>
            <button className="btn btn-primary" type="button" onClick={handleCreate} disabled={creating}>
              {creating ? '作成中...' : 'ルームを作成'}
            </button>
          </div>
          <div className="lobby-card lobby-card--duo">
            <div className="lobby-card-title">👫 二人で遊ぶ</div>
            <p className="lobby-card-desc">2人で協力してステージをクリア！難易度別に4レベル挑戦できます。</p>
            <button className="btn btn-duo" type="button" onClick={handleCreate} disabled={creating}>
              {creating ? '作成中...' : 'デュオルームを作成'}
            </button>
          </div>
          <div className="lobby-card">
            <div className="lobby-card-title">🚪 ルームに参加</div>
            <form className="lobby-join-form" onSubmit={handleJoin}>
              <div className="form-group">
                <label className="form-label" htmlFor="joinCode">ルームコード</label>
                <input
                  className="form-input"
                  id="joinCode"
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder="XXXXXX"
                  maxLength={6}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={joining}>
                {joining ? '参加中...' : '参加する'}
              </button>
            </form>
          </div>
        </div>
        <div>
          <div className="lobby-section-title">📋 最近のゲーム</div>
          {histories.length === 0 ? (
            <p className="empty-msg">まだゲームの記録がありません</p>
          ) : (
            <ul className="history-list">
              {histories.map(h => (
                <li className="history-item" key={h.id}>
                  <span className="history-code">{h.room_code}</span>
                  <span className="history-rank">{h.rank}位 / {h.player_count}人中</span>
                  <span className="history-score">{h.score}pt</span>
                  <span className="history-date">{new Date(h.played_at).toLocaleDateString('ja-JP')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
