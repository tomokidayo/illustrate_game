import { useState, ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { isAxiosError } from 'axios';

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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🌲</div>
        <h1 className="auth-title">お絵描きの森</h1>
        <p className="auth-subtitle">アカウントにログイン</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">ユーザー名</label>
            <input className="form-input" id="username" name="username" type="text"
              value={form.username} onChange={handleChange} autoComplete="username" placeholder="username" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">パスワード</label>
            <input className="form-input" id="password" name="password" type="password"
              value={form.password} onChange={handleChange} autoComplete="current-password" placeholder="••••••" />
          </div>
          {error && <p className="error-msg" role="alert">{error}</p>}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        <p className="auth-footer">
          アカウントをお持ちでない方は <Link to="/register">新規登録</Link>
        </p>
      </div>
    </div>
  );
}
