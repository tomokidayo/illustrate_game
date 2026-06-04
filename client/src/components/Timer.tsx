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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>残り</span>
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: isUrgent ? '#dc2626' : 'var(--text-h)',
            minWidth: 48,
            display: 'inline-block',
            textAlign: 'center',
          }}
        >
          {turnTimeLeft}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>秒</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)' }}>
        ゲーム残り：{formatSeconds(gameTimeLeft)}
      </div>
    </div>
  );
}
