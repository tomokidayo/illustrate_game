/** Timer コンポーネントの Props */
export interface TimerProps {
  /** 現在のターンの残り秒数 */
  turnTimeLeft: number;
  /** ゲーム全体の残り秒数 */
  gameTimeLeft: number;
}

function pad(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${pad(m)}:${pad(sec)}`;
}

/**
 * タイマーコンポーネント
 * @description ターン残り時間（大）とゲーム残り時間（小）を表示する
 */
export default function Timer({ turnTimeLeft, gameTimeLeft }: TimerProps) {
  const isUrgent = turnTimeLeft <= 10;

  return (
    <div className="timer">
      <div className="timer-turn">
        <span className="timer-turn-label">残り</span>
        <span className={`timer-turn-num${isUrgent ? ' timer-turn-num--urgent' : ''}`}>
          {turnTimeLeft}
        </span>
        <span className="timer-turn-label">秒</span>
      </div>
      <div className="timer-game">ゲーム {formatSeconds(gameTimeLeft)}</div>
    </div>
  );
}
