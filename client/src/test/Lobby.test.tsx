import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Lobby from '../pages/Lobby';
import api from '../utils/api';

vi.mock('../utils/api');
const mockedPost = api.post as Mock;

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

const mockLogout = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1', username: 'testuser' }, logout: mockLogout }),
}));

function renderLobby() {
  return render(
    <MemoryRouter>
      <Lobby />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Lobby ページ', () => {
  test('ユーザー名・ボタン・フォームが表示される', () => {
    renderLobby();
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ルームを作成' })).toBeInTheDocument();
    expect(screen.getByLabelText('ルームコード')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '参加する' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
  });

  // --- ルーム作成 ---

  test('ルーム作成成功で /room/:roomCode に遷移する', async () => {
    mockedPost.mockResolvedValueOnce({ data: { room_code: 'ABC123' } });
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'ルームを作成' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/room/ABC123'));
  });

  test('ルーム作成失敗でエラーメッセージが表示される', async () => {
    mockedPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: 'Server error' } },
    });
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'ルームを作成' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server error'));
  });

  test('ルーム作成中はボタンが無効化される', async () => {
    mockedPost.mockImplementationOnce(() => new Promise(() => {}));
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'ルームを作成' }));
    expect(screen.getByRole('button', { name: '作成中...' })).toBeDisabled();
  });

  // --- ルーム参加 ---

  test('ルームコード未入力で送信するとバリデーションエラー', async () => {
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: '参加する' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ルームコードを入力してください');
    expect(mockedPost).not.toHaveBeenCalled();
  });

  test('ルーム参加成功で /room/:roomCode に遷移する', async () => {
    mockedPost.mockResolvedValueOnce({ data: { message: 'Joined' } });
    renderLobby();
    await userEvent.type(screen.getByLabelText('ルームコード'), 'abc123');
    await userEvent.click(screen.getByRole('button', { name: '参加する' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/room/ABC123'));
  });

  test('ルームコードが大文字に正規化されてAPIに渡される', async () => {
    mockedPost.mockResolvedValueOnce({ data: { message: 'Joined' } });
    renderLobby();
    await userEvent.type(screen.getByLabelText('ルームコード'), 'abc123');
    await userEvent.click(screen.getByRole('button', { name: '参加する' }));
    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/api/rooms/ABC123/join'));
  });

  test('ルーム参加失敗でエラーメッセージが表示される', async () => {
    mockedPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: 'Room not found' } },
    });
    renderLobby();
    await userEvent.type(screen.getByLabelText('ルームコード'), 'XXXXXX');
    await userEvent.click(screen.getByRole('button', { name: '参加する' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Room not found'));
  });

  test('参加中はボタンが無効化される', async () => {
    mockedPost.mockImplementationOnce(() => new Promise(() => {}));
    renderLobby();
    await userEvent.type(screen.getByLabelText('ルームコード'), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: '参加する' }));
    expect(screen.getByRole('button', { name: '参加中...' })).toBeDisabled();
  });

  // --- ログアウト ---

  test('ログアウトボタンで logout が呼ばれ /login に遷移する', async () => {
    mockLogout.mockResolvedValueOnce(undefined);
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});
