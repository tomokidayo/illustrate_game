import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const AVATARS = ['😀','😎','🤩','😴','🐱','🐶','🐺','🦊','🐻','🐼','🐸','🐙','🦁','🐯','🐨','🐮','🌸','🌻','⭐','🌈','🎨','🎮','🍕','🎵'];

interface Friend {
  id: string;
  friendship_id: string;
  username: string;
  avatar: string | null;
  room_code: string | null;
}

interface FriendRequest {
  friendship_id: string;
  username: string;
  avatar: string | null;
}

/**
 * マイページ：アイコン選択・メールアドレス設定・フレンド管理を行うプロフィール画面
 */
export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  // プロフィール編集
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // フレンド
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [requestUsername, setRequestUsername] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [friendListError, setFriendListError] = useState('');
  const [friendActionError, setFriendActionError] = useState('');

  useEffect(() => {
    void loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        api.get<Friend[]>('/api/friends'),
        api.get<FriendRequest[]>('/api/friends/requests'),
      ]);
      setFriends(friendsRes.data);
      setRequests(requestsRes.data);
    } catch {
      setFriendListError('フレンド情報の取得に失敗しました');
    }
  };

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess(false);
    setSaving(true);
    try {
      const { data } = await api.put<{ email: string | null; avatar: string | null }>('/api/profile', { email, avatar });
      updateUser({ email: data.email, avatar: data.avatar });
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(isAxiosError(err) ? err.response?.data?.error ?? '保存に失敗しました' : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleSendRequest = async (e: FormEvent) => {
    e.preventDefault();
    setRequestError('');
    setRequestSuccess('');
    setSendingRequest(true);
    try {
      await api.post('/api/friends/request', { username: requestUsername.trim() });
      setRequestSuccess('フレンド申請を送りました');
      setRequestUsername('');
    } catch (err) {
      setRequestError(isAxiosError(err) ? err.response?.data?.error ?? '申請に失敗しました' : '申請に失敗しました');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAccept = async (friendshipId: string) => {
    try {
      setFriendActionError('');
      await api.put(`/api/friends/${friendshipId}/accept`);
      await loadFriends();
    } catch (err) {
      setFriendActionError(isAxiosError(err) ? err.response?.data?.error ?? '承認に失敗しました' : '承認に失敗しました');
    }
  };

  const handleDelete = async (friendshipId: string) => {
    try {
      setFriendActionError('');
      await api.delete(`/api/friends/${friendshipId}`);
      await loadFriends();
    } catch (err) {
      setFriendActionError(isAxiosError(err) ? err.response?.data?.error ?? '操作に失敗しました' : '操作に失敗しました');
    }
  };

  const handleJoinRoom = async (roomCode: string) => {
    try {
      setFriendActionError('');
      await api.post(`/api/rooms/${roomCode}/join`);
      navigate(`/room/${roomCode}`);
    } catch (err) {
      setFriendActionError(isAxiosError(err) ? err.response?.data?.error ?? '参加に失敗しました' : '参加に失敗しました');
    }
  };

  return (
    <div className="lobby-layout">
      <header className="lobby-header">
        <div className="lobby-header-logo">🌲 お絵描きの森</div>
        <div className="lobby-header-user">
          {user?.avatar && <span className="lobby-user-avatar">{user.avatar}</span>}
          <span>{user?.username}</span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('/lobby')}>
            ロビーへ
          </button>
        </div>
      </header>

      <main className="lobby-main">

        {/* ── プロフィール編集 ── */}
        <div className="lobby-card">
          <div className="lobby-card-title">👤 プロフィール</div>

          <form className="auth-form" onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="avatar-section">アイコン</label>
              <div className="avatar-picker" id="avatar-section">
                {AVATARS.map(a => (
                  <button
                    key={a}
                    type="button"
                    className={`avatar-option${avatar === a ? ' avatar-option--selected' : ''}`}
                    onClick={() => setAvatar(prev => prev === a ? '' : a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {avatar && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setAvatar('')}>
                  選択を解除
                </button>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">メールアドレス（任意）</label>
              <input
                className="form-input"
                id="email"
                type="email"
                value={email ?? ''}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@mail.com"
              />
            </div>

            {profileError && <p className="error-msg" role="alert">{profileError}</p>}
            {profileSuccess && <p className="success-msg" role="status">保存しました</p>}

            <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存する'}
            </button>
          </form>
        </div>

        {/* ── フレンド ── */}
        <div className="lobby-card">
          <div className="lobby-card-title">👥 フレンド</div>

          {/* 申請フォーム */}
          <form className="friend-request-form" onSubmit={handleSendRequest}>
            <input
              className="form-input"
              type="text"
              value={requestUsername}
              onChange={e => setRequestUsername(e.target.value)}
              placeholder="ユーザー名でフレンド申請"
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={sendingRequest || !requestUsername.trim()}>
              申請
            </button>
          </form>
          {requestError && <p className="error-msg" role="alert">{requestError}</p>}
          {requestSuccess && <p className="success-msg" role="status">{requestSuccess}</p>}
          {friendListError && <p className="error-msg" role="alert">{friendListError}</p>}
          {friendActionError && <p className="error-msg" role="alert">{friendActionError}</p>}

          {/* 受信した申請 */}
          {requests.length > 0 && (
            <>
              <div className="lobby-section-title">受信した申請 ({requests.length})</div>
              <ul className="friend-list">
                {requests.map(r => (
                  <li key={r.friendship_id} className="friend-item">
                    <span className="friend-avatar">{r.avatar ?? '👤'}</span>
                    <span className="friend-name">{r.username}</span>
                    <div className="friend-actions">
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => void handleAccept(r.friendship_id)}>承認</button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => void handleDelete(r.friendship_id)}>拒否</button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* フレンド一覧 */}
          <div className="lobby-section-title">フレンド ({friends.length})</div>
          {friends.length === 0 ? (
            <p className="empty-msg">まだフレンドがいません</p>
          ) : (
            <ul className="friend-list">
              {friends.map(f => (
                <li key={f.friendship_id} className="friend-item">
                  <span className="friend-avatar">{f.avatar ?? '👤'}</span>
                  <span className="friend-name">{f.username}</span>
                  <div className="friend-actions">
                    {f.room_code && (
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => void handleJoinRoom(f.room_code!)}>
                        🎮 参加
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => void handleDelete(f.friendship_id)}>解除</button>
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
