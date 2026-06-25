import { useState, ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { isAxiosError } from 'axios';

/**
 * ログイン画面：森をテーマにした暖色系デザイン
 */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = (): string | null => {
    if (!form.username || !form.password) return 'ユーザー名とパスワードを入力してください';
    return null;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<{ token: string; user: { id: string; username: string } }>(
        '/api/auth/login',
        form
      );
      login(data.user, data.token);
      navigate('/lobby');
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.error ?? 'ログインに失敗しました' : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <header className="lobby-header">
        <Link className="lobby-header-logo" to="/lobby">🌲 お絵描きの森</Link>
      </header>

      <div className="login-header">
        <h1 className="login-title">お絵描きの森</h1>
        <p className="login-subtitle">想像力が広がる、木漏れ日の空間。</p>
      </div>

      <div className="login-card">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="login-label" htmlFor="username">ユーザー名</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </span>
              <input
                className="login-input"
                id="username"
                name="username"
                type="text"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                placeholder="森の友達_42"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="login-label" htmlFor="password">パスワード</label>
            <div className="login-input-wrapper">
              <span className="login-input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
              </span>
              <input
                className="login-input"
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <p className="error-msg" role="alert">{error}</p>}

          <button className="login-btn-primary" type="submit" disabled={loading}>
            {loading ? 'ログイン中...' : '森に入る →'}
          </button>
        </form>

        <div className="login-footer">
          <Link to="/register" className="login-register-link">新しく森の仲間になる（新規登録）</Link>
        </div>
      </div>

      <div className="login-deco-icons" aria-hidden="true">
        <span className="login-deco-icon login-deco-icon--teal">✏️</span>
        <span className="login-deco-icon login-deco-icon--yellow">🖌️</span>
        <span className="login-deco-icon login-deco-icon--blue">🎨</span>
      </div>
    </div>
  );
}
