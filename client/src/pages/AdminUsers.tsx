import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

interface AdminUser {
  id: string;
  username: string;
  avatar: string | null;
  created_at: string;
}

const ADMIN_USERNAME = 'tomoki';

/** 管理者用ユーザー一覧ページ */
export default function AdminUsers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.username !== ADMIN_USERNAME) {
      navigate('/lobby');
      return;
    }
    api.get<AdminUser[]>('/api/admin/users')
      .then(res => setUsers(res.data))
      .catch(() => setError('ユーザー一覧の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (user?.username !== ADMIN_USERNAME) return null;

  return (
    <div className="lobby-layout">
      <header className="lobby-header">
        <div className="lobby-header-logo">🌲 お絵描きの森</div>
        <div className="lobby-header-user">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('/lobby')}>
            ← ロビーに戻る
          </button>
        </div>
      </header>
      <main className="lobby-main">
        <div className="lobby-section-title">👤 ユーザー一覧</div>
        {loading && <p className="empty-msg">読み込み中...</p>}
        {error && <p className="error-msg" role="alert">{error}</p>}
        {!loading && !error && (
          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>アバター</th>
                  <th>ユーザー名</th>
                  <th>登録日</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="admin-users-avatar">{u.avatar ?? '—'}</td>
                    <td>{u.username}</td>
                    <td>{new Date(u.created_at).toLocaleDateString('ja-JP')}</td>
                    <td className="admin-users-id">{u.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="admin-users-count">合計 {users.length} 人</p>
          </div>
        )}
      </main>
    </div>
  );
}
