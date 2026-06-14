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
    <div className="scoreboard">
      <div className="scoreboard-title">プレイヤー</div>
      <ul className="scoreboard-list">
        {sorted.map(p => {
          const isDrawerItem = p.userId === drawerId;
          return (
            <li key={p.userId} className={`scoreboard-item${isDrawerItem ? ' scoreboard-item--drawer' : ''}`}>
              <span className="scoreboard-name">
                {isDrawerItem && <span title="絵描き役">✏️</span>}
                {p.avatar && <span className="scoreboard-avatar">{p.avatar}</span>}
                {p.username}
              </span>
              <span className="scoreboard-score">{p.score}pt</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
