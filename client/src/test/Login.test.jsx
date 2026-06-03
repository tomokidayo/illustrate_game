import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { AuthProvider } from '../context/AuthContext';
import api from '../utils/api';

vi.mock('../utils/api');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Login ページ', () => {
  test('フォームが表示される', () => {
    renderLogin();
    expect(screen.getByLabelText('ユーザー名')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });

  test('未入力で送信するとエラーが表示される', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ユーザー名とパスワードを入力してください');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('ログイン成功で /lobby にリダイレクト', async () => {
    api.post.mockResolvedValueOnce({
      data: { token: 'test-token', user: { id: '1', username: 'testuser' } },
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'testuser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/lobby'));
  });

  test('ログイン成功でトークンが localStorage に保存される', async () => {
    api.post.mockResolvedValueOnce({
      data: { token: 'test-token', user: { id: '1', username: 'testuser' } },
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'testuser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() => expect(localStorage.getItem('token')).toBe('test-token'));
  });

  test('API エラー時にエラーメッセージが表示される', async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } },
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'testuser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials'));
  });

  test('送信中はボタンが無効化される', async () => {
    api.post.mockImplementationOnce(() => new Promise(() => {}));
    renderLogin();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'testuser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(screen.getByRole('button', { name: 'ログイン中...' })).toBeDisabled();
  });
});
