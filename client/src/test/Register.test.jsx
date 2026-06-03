import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from '../pages/Register';
import api from '../utils/api';

vi.mock('../utils/api');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Register ページ', () => {
  test('フォームが表示される', () => {
    renderRegister();
    expect(screen.getByLabelText('ユーザー名')).toBeInTheDocument();
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument();
  });

  test('未入力で送信するとエラーが表示される', async () => {
    renderRegister();
    await userEvent.click(screen.getByRole('button', { name: '登録する' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ユーザー名とパスワードを入力してください');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('username が短すぎるとエラーが表示される', async () => {
    renderRegister();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'a');
    await userEvent.type(screen.getByLabelText('パスワード'), 'pass123');
    await userEvent.click(screen.getByRole('button', { name: '登録する' }));
    expect(screen.getByRole('alert')).toHaveTextContent('2〜20文字');
  });

  test('username に不正文字が含まれるとエラーが表示される', async () => {
    renderRegister();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'user name!');
    await userEvent.type(screen.getByLabelText('パスワード'), 'pass123');
    await userEvent.click(screen.getByRole('button', { name: '登録する' }));
    expect(screen.getByRole('alert')).toHaveTextContent('英数字・アンダースコアのみ');
  });

  test('password が短すぎるとエラーが表示される', async () => {
    renderRegister();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'validuser');
    await userEvent.type(screen.getByLabelText('パスワード'), '123');
    await userEvent.click(screen.getByRole('button', { name: '登録する' }));
    expect(screen.getByRole('alert')).toHaveTextContent('6文字以上');
  });

  test('登録成功で /login にリダイレクト', async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    renderRegister();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'newuser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '登録する' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  test('API エラー時にエラーメッセージが表示される', async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { error: 'Username already taken' } },
    });
    renderRegister();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'existinguser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '登録する' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Username already taken'));
  });

  test('送信中はボタンが無効化される', async () => {
    api.post.mockImplementationOnce(() => new Promise(() => {}));
    renderRegister();
    await userEvent.type(screen.getByLabelText('ユーザー名'), 'newuser');
    await userEvent.type(screen.getByLabelText('パスワード'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '登録する' }));
    expect(screen.getByRole('button', { name: '登録中...' })).toBeDisabled();
  });
});
