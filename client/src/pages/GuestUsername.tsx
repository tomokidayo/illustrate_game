import { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

interface LocationState {
  action: 'create' | 'create-duo' | 'join';
  roomCode?: string;
}

/**
 * ゲストユーザー用ユーザー名入力画面
 * @description アカウント登録なしでゲームに参加するためのユーザー名を設定する
 */
export default function GuestUsername() {
  const navigate = useNavigate();
  const location = useLocation();
  const { guestLogin } = useAuth();
  const state = (location.state ?? {}) as LocationState;
  const { action = 'create', roomCode } = state;

  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) { setError('ユーザー名を入力してください'); return; }
    if (name.length < 2 || name.length > 20) { setError('ユーザー名は2〜20文字で入力してください'); return; }

    setError('');
    setLoading(true);
    try {
      // ゲスト用一時JWTを取得
      const { data: authData } = await api.post<{ token: string; user: { id: string; username: string; isGuest: boolean } }>(
        '/api/auth/guest',
        { username: name }
      );
      guestLogin({ ...authData.user }, authData.token);

      if (action === 'create' || action === 'create-duo') {
        const { data: room } = await api.post<{ room_code: string }>('/api/rooms');
        const isDuo = action === 'create-duo';
        navigate(`/room/${room.room_code}`, isDuo ? { state: { isDuoRoom: true } } : undefined);
      } else {
        const code = (roomCode ?? '').toUpperCase();
        await api.post(`/api/rooms/${code}/join`);
        navigate(`/room/${code}`);
      }
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.error ?? 'エラーが発生しました' : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const actionLabel = action === 'join' ? 'ルームに参加する' : 'ルームを作成する';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🌲 お絵描きの森</div>
        <h1 className="auth-title">ゲストとして参加</h1>
        <p className="auth-subtitle">このゲームで使うニックネームを入力してください</p>

        {error && <p className="error-msg" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">ニックネーム</label>
            <input
              className="form-input"
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="2〜20文字で入力"
              maxLength={20}
              autoFocus
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? '処理中...' : actionLabel}
          </button>
        </form>

        <p className="auth-link-text">
          アカウントをお持ちの方は
          <a className="auth-link" href="/login">こちら</a>
        </p>
      </div>
    </div>
  );
}
