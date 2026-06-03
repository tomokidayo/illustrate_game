import { useState, ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api from '../utils/api';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = (): string | null => {
    if (!form.username || !form.password) return 'ユーザー名とパスワードを入力してください';
    if (form.username.length < 2 || form.username.length > 20) return 'ユーザー名は2〜20文字で入力してください';
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return 'ユーザー名は英数字・アンダースコアのみ使用できます';
    if (form.password.length < 6) return 'パスワードは6文字以上で入力してください';
    return null;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');
    try {
      await api.post('/api/auth/register', form);
      navigate('/login');
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.error ?? '登録に失敗しました' : '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>新規登録</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">ユーザー名</label>
          <input
            id="username"
            name="username"
            type="text"
            value={form.username}
            onChange={handleChange}
            autoComplete="username"
          />
        </div>
        <div>
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? '登録中...' : '登録する'}
        </button>
      </form>
      <p>すでにアカウントをお持ちの方は<Link to="/login">ログイン</Link></p>
    </div>
  );
}
