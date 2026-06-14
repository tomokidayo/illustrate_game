import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const AVATARS = ['😀','😎','🤩','😴','🐱','🐶','🐺','🦊','🐻','🐼','🐸','🐙','🦁','🐯','🐨','🐮','🌸','🌻','⭐','🌈','🎨','🎮','🍕','🎵'];

/**
 * マイページ：アイコン選択・メールアドレス設定を行うプロフィール画面
 */
export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(user?.email ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      const { data } = await api.put<{ email: string | null; avatar: string | null }>('/api/profile', { email, avatar });
      updateUser({ email: data.email, avatar: data.avatar });
      setSuccess(true);
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.error ?? '保存に失敗しました' : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', fontSize: 32 }}>🌲</div>
        <h1 className="auth-title">マイページ</h1>
        <p className="auth-subtitle">{user?.username}</p>

        <form onSubmit={handleSubmit}>
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
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setAvatar('')}>
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

          {error && <p className="error-msg" role="alert">{error}</p>}
          {success && <p className="success-msg" role="status">保存しました</p>}

          <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
            {saving ? '保存中...' : '保存する'}
          </button>
        </form>

        <button className="btn btn-ghost btn-full" type="button" onClick={() => navigate('/lobby')} style={{ marginTop: 8 }}>
          ロビーに戻る
        </button>
      </div>
    </div>
  );
}
