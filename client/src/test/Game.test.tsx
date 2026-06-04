import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Game from '../pages/Game';
import { useGame, UseGameReturn } from '../hooks/useGame';

vi.mock('../components/Canvas', () => ({ default: () => <div data-testid="canvas" /> }));
vi.mock('../components/Chat', () => ({ default: () => <div data-testid="chat" /> }));
vi.mock('../components/Timer', () => ({ default: () => <div data-testid="timer" /> }));
vi.mock('../components/Scoreboard', () => ({ default: () => <div data-testid="scoreboard" /> }));

vi.mock('../hooks/useGame');
const mockedUseGame = useGame as Mock;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', username: 'testuser' } }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useParams: () => ({ roomCode: 'ROOM01' }),
  useNavigate: () => mockNavigate,
}));

const mockStartGame = vi.fn();

/** useGame の戻り値を組み立てるヘルパー */
function buildGame(overrides: Partial<UseGameReturn> = {}): UseGameReturn {
  return {
    gameStatus: 'connecting',
    players: [],
    turn: null,
    messages: [],
    turnEndInfo: null,
    drawQueueRef: { current: [] },
    clearSignal: 0,
    isHost: false,
    send: vi.fn(),
    startGame: mockStartGame,
    submitAnswer: vi.fn(),
    sendDraw: vi.fn(),
    sendClear: vi.fn(),
    ...overrides,
  };
}

function renderGame() {
  return render(
    <MemoryRouter>
      <Game />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── 接続中フェーズ ────────────────────────────────────────────────────────────

describe('接続中フェーズ', () => {
  test('「接続中...」が表示される', () => {
    mockedUseGame.mockReturnValue(buildGame({ gameStatus: 'connecting' }));
    renderGame();
    expect(screen.getByText('接続中...')).toBeInTheDocument();
  });
});

// ─── 待機フェーズ ─────────────────────────────────────────────────────────────

describe('待機フェーズ', () => {
  const threePlayers = [
    { userId: 'user-1', username: 'testuser', score: 0 },
    { userId: 'user-2', username: 'player2', score: 0 },
    { userId: 'user-3', username: 'player3', score: 0 },
  ];

  test('ホストで3人以上いると開始ボタンが有効', () => {
    mockedUseGame.mockReturnValue(buildGame({ gameStatus: 'waiting', players: threePlayers, isHost: true }));
    renderGame();
    expect(screen.getByRole('button', { name: 'ゲーム開始' })).toBeEnabled();
  });

  test('ホストで3人未満だと開始ボタンが無効', () => {
    mockedUseGame.mockReturnValue(buildGame({
      gameStatus: 'waiting',
      players: [threePlayers[0], threePlayers[1]],
      isHost: true,
    }));
    renderGame();
    expect(screen.getByRole('button', { name: 'ゲーム開始' })).toBeDisabled();
  });

  test('ホストが開始ボタンを押すと startGame が呼ばれる', async () => {
    mockedUseGame.mockReturnValue(buildGame({ gameStatus: 'waiting', players: threePlayers, isHost: true }));
    renderGame();
    await userEvent.click(screen.getByRole('button', { name: 'ゲーム開始' }));
    expect(mockStartGame).toHaveBeenCalled();
  });

  test('非ホストには開始ボタンが表示されない', () => {
    mockedUseGame.mockReturnValue(buildGame({ gameStatus: 'waiting', players: threePlayers, isHost: false }));
    renderGame();
    expect(screen.queryByRole('button', { name: 'ゲーム開始' })).not.toBeInTheDocument();
  });

  test('非ホストに待機メッセージが表示される', () => {
    mockedUseGame.mockReturnValue(buildGame({ gameStatus: 'waiting', players: threePlayers, isHost: false }));
    renderGame();
    expect(screen.getByText(/ホストがゲームを開始するまで/)).toBeInTheDocument();
  });

  test('接続人数が表示される', () => {
    mockedUseGame.mockReturnValue(buildGame({ gameStatus: 'waiting', players: threePlayers, isHost: true }));
    renderGame();
    expect(screen.getByText(/3 人接続中/)).toBeInTheDocument();
  });
});

// ─── プレイフェーズ ───────────────────────────────────────────────────────────

describe('プレイフェーズ', () => {
  let playingBase: UseGameReturn;

  beforeEach(() => {
    playingBase = buildGame({
      gameStatus: 'playing',
      players: [
        { userId: 'user-1', username: 'testuser', score: 0 },
        { userId: 'user-2', username: 'player2', score: 1 },
      ],
      turn: { drawerId: 'user-2', drawerName: 'player2', turnTimeLeft: 25, gameTimeLeft: 280 },
    });
  });

  test('Canvas・Scoreboard・Chat が表示される', () => {
    mockedUseGame.mockReturnValue(playingBase);
    renderGame();
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.getByTestId('scoreboard')).toBeInTheDocument();
    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });

  test('自分が絵描き役のとき題バナーとお題が表示される', () => {
    mockedUseGame.mockReturnValue(buildGame({
      gameStatus: 'playing',
      turn: { drawerId: 'user-1', drawerName: 'testuser', topic: 'ライオン', turnTimeLeft: 25, gameTimeLeft: 280 },
    }));
    renderGame();
    expect(screen.getByText(/あなたが絵描き役/)).toBeInTheDocument();
    expect(screen.getByText(/ライオン/)).toBeInTheDocument();
  });

  test('自分が絵描き役でないときバナーが表示されない', () => {
    mockedUseGame.mockReturnValue(playingBase);
    renderGame();
    expect(screen.queryByText(/あなたが絵描き役/)).not.toBeInTheDocument();
  });
});

// ─── 終了フェーズ ─────────────────────────────────────────────────────────────

describe('終了フェーズ', () => {
  const finishedPlayers = [
    { userId: 'user-1', username: 'testuser', score: 3 },
    { userId: 'user-2', username: 'player2', score: 5 },
    { userId: 'user-3', username: 'player3', score: 1 },
  ];

  test('最終スコアが降順で表示される', () => {
    mockedUseGame.mockReturnValue(buildGame({ gameStatus: 'finished', players: finishedPlayers }));
    renderGame();
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('player2');
    expect(items[1]).toHaveTextContent('testuser');
    expect(items[2]).toHaveTextContent('player3');
  });

  test('「ロビーに戻る」ボタンで /lobby に遷移する', async () => {
    mockedUseGame.mockReturnValue(buildGame({ gameStatus: 'finished', players: finishedPlayers }));
    renderGame();
    await userEvent.click(screen.getByRole('button', { name: 'ロビーに戻る' }));
    expect(mockNavigate).toHaveBeenCalledWith('/lobby');
  });
});

// ─── ターン終了オーバーレイ ───────────────────────────────────────────────────

describe('ターン終了オーバーレイ', () => {
  const baseTurn = { drawerId: 'user-2', drawerName: 'player2', turnTimeLeft: 0, gameTimeLeft: 200 };

  test('正解時に正解者名とお題が表示される', () => {
    mockedUseGame.mockReturnValue(buildGame({
      gameStatus: 'playing',
      turn: baseTurn,
      turnEndInfo: { topic: 'ゾウ', correct: { userId: 'user-1', username: 'testuser' } },
    }));
    renderGame();
    expect(screen.getByText(/testuser が正解/)).toBeInTheDocument();
    expect(screen.getByText(/ゾウ/)).toBeInTheDocument();
  });

  test('時間切れ時にタイムアウトメッセージとお題が表示される', () => {
    mockedUseGame.mockReturnValue(buildGame({
      gameStatus: 'playing',
      turn: baseTurn,
      turnEndInfo: { topic: 'キリン', correct: null },
    }));
    renderGame();
    expect(screen.getByText('時間切れ')).toBeInTheDocument();
    expect(screen.getByText(/キリン/)).toBeInTheDocument();
  });
});
