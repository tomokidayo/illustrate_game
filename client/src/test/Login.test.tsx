import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { AuthProvider } from '../context/AuthContext';
import api from '../utils/api';

vi.mock('../utils/api');
const mockedPost = api.post as Mock;

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
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
    expect(screen.getByRole('button', { name: '森に入る →' })).toBeInTheDocument();
  });

  test('未入力で送信するとエラーが表示される', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: '森に入る →' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ユーザー名とパスワードを入力してください');
    expect(mockedPost).not.toHaveBeenCalled();
  });

  test('ログイン成功で /lobby にリダイレクト', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { token: 'test-token', user: { id: '1', username: 'testuser' } },
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'testuser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '森に入る →' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/lobby'));
  });

  test('ログイン成功でトークンが localStorage に保存される', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { token: 'test-token', user: { id: '1', username: 'testuser' } },
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'testuser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '森に入る →' }));
    await waitFor(() => expect(localStorage.getItem('token')).toBe('test-token'));
  });

  test('API エラー時にエラーメッセージが表示される', async () => {
    mockedPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: 'Invalid credentials' } },
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'testuser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: '森に入る →' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials'));
  });

  test('送信中はボタンが無効化される', async () => {
    mockedPost.mockImplementationOnce(() => new Promise(() => {}));
    renderLogin();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'testuser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '森に入る →' }));
    expect(screen.getByRole('button', { name: 'ログイン中...' })).toBeDisabled();
  });
});
