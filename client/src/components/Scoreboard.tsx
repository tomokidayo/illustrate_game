import { Player } from '../hooks/useGame';

/** Scoreboard コンポーネントの Props */
export interface ScoreboardProps {
  /** プレイヤー一覧 */
  players: Player[];
  /** 現在の絵描き役のユーザーID（ハイライトに使用） */
  drawerId?: string;
}

/**
 * スコアボードコンポーネント
 * @description プレイヤーをスコア降順で表示し、絵描き役をハイライトする
 */
export default function Scoreboard({ players, drawerId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div style={{ padding: '8px 12px' }}>
      <h2 style={{ fontSize: 15, margin: '0 0 8px', color: 'var(--text-h)' }}>プレイヤー</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map(p => {
          const isDrawer = p.userId === drawerId;
          return (
            <li
              key={p.userId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 6,
                background: isDrawer ? 'var(--accent-bg)' : 'transparent',
                border: isDrawer ? '1px solid var(--accent-border)' : '1px solid transparent',
              }}
            >
              <span style={{ fontSize: 14, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {isDrawer && <span title="絵描き役">✏️</span>}
                {p.username}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
                {p.score}pt
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
