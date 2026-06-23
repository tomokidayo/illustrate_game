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

const ADMIN_USERNAME = 'tomoki';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 2) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨日';
  return `${days}日前`;
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

  const handleCreate = async (isDuo = false) => {
    setError('');
    setCreating(true);
    try {
      const { data } = await api.post<{ room_code: string }>('/api/rooms');
      navigate(`/room/${data.room_code}`, isDuo ? { state: { isDuoRoom: true } } : undefined);
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
          <Link className="btn btn-ghost btn-sm" to="/rules">ルール</Link>
          {user?.username === ADMIN_USERNAME && (
            <Link className="btn btn-ghost btn-sm" to="/admin/users">管理者</Link>
          )}
          <button className="btn btn-ghost btn-sm" type="button" onClick={handleLogout}>ログアウト</button>
          <Link className="lobby-avatar-circle" to="/profile" title="マイページ">
            {user?.avatar ?? user?.username?.[0]?.toUpperCase() ?? '?'}
          </Link>
        </div>

        {/* モバイル用：アバター + ハンバーガー */}
        <div className="lobby-header-mobile">
          <Link className="lobby-avatar-circle" to="/profile" title="マイページ">
            {user?.avatar ?? user?.username?.[0]?.toUpperCase() ?? '?'}
          </Link>
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
        </div>

        {/* モバイル用ドロップダウン */}
        {menuOpen && (
          <>
            <div className="lobby-menu-overlay" onClick={() => setMenuOpen(false)} />
            <nav className="lobby-menu-dropdown">
              <div className="lobby-menu-user">
                {user?.avatar && <span className="lobby-user-avatar">{user.avatar}</span>}
                <span className="lobby-menu-username">{user?.username}</span>
              </div>
              <Link className="lobby-menu-item" to="/profile" onClick={() => setMenuOpen(false)}>
                マイページ
              </Link>
              <Link className="lobby-menu-item" to="/rules" onClick={() => setMenuOpen(false)}>
                ルール
              </Link>
              {user?.username === ADMIN_USERNAME && (
                <Link className="lobby-menu-item" to="/admin/users" onClick={() => setMenuOpen(false)}>
                  管理者
                </Link>
              )}
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
          {/* 対戦ルーム作成カード */}
          <div className="lobby-card">
            <div className="lobby-hero-deco" aria-hidden="true">🎨</div>
            <div className="lobby-card-title">対戦ルームを作成</div>
            <p className="lobby-card-desc">新しいゲームルームを作成して、友達を招待しましょう。3人以上で遊べるよ。</p>
            <button className="lobby-hero-btn" type="button" onClick={() => handleCreate()} disabled={creating}>
              <span>⊕</span>
              {creating ? '作成中...' : '部屋を作る'}
            </button>
          </div>

          {/* デュオカード */}
          <div className="lobby-card lobby-card--duo">
            <div className="lobby-hero-deco" aria-hidden="true">👫</div>
            <div className="lobby-card-title">二人で遊ぶ</div>
            <p className="lobby-card-desc">2人で協力してステージをクリア！難易度別に4レベル挑戦できます。</p>
            <button className="lobby-hero-btn" type="button" onClick={() => handleCreate(true)} disabled={creating}>
              <span>⊕</span>
              {creating ? '作成中...' : 'デュオルームを作成'}
            </button>
          </div>

          {/* ルーム参加カード */}
          <div className="lobby-card">
            <div className="lobby-hero-deco" aria-hidden="true">🚪</div>
            <div className="lobby-card-title">ルームに参加</div>
            <p className="lobby-card-desc">ルームコードを入力して、友達のゲームに参加しましょう。</p>
            <form className="lobby-join-row" onSubmit={handleJoin}>
              <input
                className="lobby-join-input"
                id="joinCode"
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                placeholder="ルームコードを入力..."
                maxLength={6}
              />
              <button className="lobby-join-submit" type="submit" disabled={joining} aria-label="参加する">
                →
              </button>
            </form>
          </div>
        </div>

        {/* 最近の対戦履歴 */}
        <div>
          <div className="lobby-section-header">
            <span className="lobby-section-title">🕐 最近の対戦履歴</span>
          </div>
          {histories.length === 0 ? (
            <p className="empty-msg">まだゲームの記録がありません</p>
          ) : (
            <ul className="history-card-list">
              {histories.map(h => (
                <li className="history-card" key={h.id}>
                  <div className="history-card-top">
                    <span className="history-card-rank">{h.rank}位</span>
                    <span className="history-card-time">{timeAgo(h.played_at)}</span>
                  </div>
                  <div className="history-card-body">
                    <div className="history-card-icon">🎨</div>
                    <div>
                      <div className="history-card-code">{h.room_code}</div>
                      <div className="history-card-score">スコア: {h.score} pt</div>
                    </div>
                  </div>
                  <div className="history-card-footer">
                    {h.player_count}人参加
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
