import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Lobby from '../pages/Lobby';
import api from '../utils/api';

vi.mock('../utils/api');
const mockedPost = api.post as Mock;
const mockedGet = api.get as Mock;

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

// vi.hoisted で vi.mock ファクトリから参照できる変数を宣言する
const mockAuthState = vi.hoisted(() => ({
  user: { id: '1', username: 'testuser' } as
    | { id: string; username: string; isGuest?: boolean }
    | null,
  logout: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthState.user, logout: mockAuthState.logout }),
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
  mockAuthState.user = { id: '1', username: 'testuser' };
  mockedGet.mockResolvedValue({ data: [] });
});

// ─── 基本表示 ─────────────────────────────────────────────────────────────────

describe('Lobby ページ（ログイン済み）', () => {
  test('ボタン・フォームが表示される', () => {
    renderLobby();
    expect(screen.getByRole('button', { name: /部屋を作る/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /デュオルームを作成/ })).toBeInTheDocument();
    expect(screen.getByLabelText('ルームコード')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '参加する' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
  });

  // --- ルーム作成 ---

  test('ルーム作成成功で /room/:roomCode に遷移する', async () => {
    mockedPost.mockResolvedValueOnce({ data: { room_code: 'ABC123' } });
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: /部屋を作る/ }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/room/ABC123', undefined));
  });

  test('ルーム作成失敗でエラーメッセージが表示される', async () => {
    mockedPost.mockRejectedValueOnce(new Error('Server error'));
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: /部屋を作る/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ルーム作成に失敗しました'));
  });

  test('ルーム作成中はボタンが無効化される', async () => {
    mockedPost.mockImplementationOnce(() => new Promise(() => {}));
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: /部屋を作る/ }));
    // creating フラグが立つと2つの作成ボタンがどちらも無効化される
    const creatingBtns = screen.getAllByRole('button', { name: /作成中\.\.\./ });
    expect(creatingBtns.length).toBeGreaterThan(0);
    creatingBtns.forEach(btn => expect(btn).toBeDisabled());
  });

  // --- デュオルーム作成 ---

  test('デュオルーム作成成功で /room/:roomCode?state=isDuoRoom に遷移する', async () => {
    mockedPost.mockResolvedValueOnce({ data: { room_code: 'DUO123' } });
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: /デュオルームを作成/ }));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/room/DUO123', { state: { isDuoRoom: true } })
    );
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
    mockedPost.mockRejectedValueOnce(new Error('Room not found'));
    renderLobby();
    await userEvent.type(screen.getByLabelText('ルームコード'), 'XXXXXX');
    await userEvent.click(screen.getByRole('button', { name: '参加する' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ルームへの参加に失敗しました'));
  });

  test('参加中はボタンが無効化される', async () => {
    mockedPost.mockImplementationOnce(() => new Promise(() => {}));
    renderLobby();
    await userEvent.type(screen.getByLabelText('ルームコード'), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: '参加する' }));
    expect(screen.getByRole('button', { name: '参加する' })).toBeDisabled();
  });

  // --- ログアウト ---

  test('ログアウトボタンで logout が呼ばれ /lobby に遷移する', async () => {
    mockAuthState.logout.mockResolvedValueOnce(undefined);
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    await waitFor(() => {
      expect(mockAuthState.logout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/lobby');
    });
  });

  // --- ゲーム履歴 ---

  test('「最近の対戦履歴」セクションが表示される', () => {
    renderLobby();
    expect(screen.getByText(/最近の対戦履歴/)).toBeInTheDocument();
  });

  test('履歴が空のとき「まだゲームの記録がありません」と表示される', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });
    renderLobby();
    await waitFor(() => expect(screen.getByText('まだゲームの記録がありません')).toBeInTheDocument());
  });

  test('履歴があるときルームコード・順位・スコアが表示される', async () => {
    mockedGet.mockResolvedValueOnce({
      data: [{
        id: 'game-1',
        room_code: 'ABCDEF',
        played_at: '2026-06-05T10:00:00Z',
        score: 3,
        rank: 1,
        player_count: 4,
      }],
    });
    renderLobby();
    await waitFor(() => expect(screen.getByText('ABCDEF')).toBeInTheDocument());
    expect(screen.getByText(/1位/)).toBeInTheDocument();
    expect(screen.getByText(/3 pt/)).toBeInTheDocument();
  });
});

// ─── ゲストユーザー ────────────────────────────────────────────────────────────

describe('Lobby ページ（ゲストユーザー）', () => {
  beforeEach(() => {
    mockAuthState.user = { id: 'guest_abc', username: 'ゲスト花子', isGuest: true };
  });

  test('「ゲスト終了」ボタンが表示される', () => {
    renderLobby();
    expect(screen.getByRole('button', { name: 'ゲスト終了' })).toBeInTheDocument();
  });

  test('「最近の対戦履歴」セクションが表示されない', () => {
    renderLobby();
    expect(screen.queryByText(/最近の対戦履歴/)).not.toBeInTheDocument();
  });

  test('ゲスト終了で logout が呼ばれ /lobby に遷移する', async () => {
    mockAuthState.logout.mockResolvedValueOnce(undefined);
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: 'ゲスト終了' }));
    await waitFor(() => {
      expect(mockAuthState.logout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/lobby');
    });
  });
});

// ─── 未ログイン（ゲストフロー） ───────────────────────────────────────────────

describe('Lobby ページ（未ログイン）', () => {
  beforeEach(() => {
    mockAuthState.user = null;
  });

  test('「ログイン」リンクが表示される', () => {
    renderLobby();
    // デスクトップ・モバイル両方のヘッダーに表示されるため複数存在する
    const loginLinks = screen.getAllByRole('link', { name: 'ログイン' });
    expect(loginLinks.length).toBeGreaterThan(0);
  });

  test('「部屋を作る」クリックで /guest-username にステート付きで遷移する', async () => {
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: /部屋を作る/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/guest-username', { state: { action: 'create' } });
  });

  test('「デュオルームを作成」クリックで create-duo ステートで遷移する', async () => {
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: /デュオルームを作成/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/guest-username', { state: { action: 'create-duo' } });
  });

  test('ルームコード入力後「参加する」クリックで join ステートで遷移する', async () => {
    renderLobby();
    await userEvent.type(screen.getByLabelText('ルームコード'), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: '参加する' }));
    expect(mockNavigate).toHaveBeenCalledWith('/guest-username', {
      state: { action: 'join', roomCode: 'ABC123' },
    });
  });

  test('「最近の対戦履歴」セクションが表示されない', () => {
    renderLobby();
    expect(screen.queryByText(/最近の対戦履歴/)).not.toBeInTheDocument();
  });
});
