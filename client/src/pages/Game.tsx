import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGame, GameMode } from '../hooks/useGame';
import Canvas from '../components/Canvas';
import Chat from '../components/Chat';
import Timer from '../components/Timer';
import Scoreboard from '../components/Scoreboard';

const DUO_CLEAR_COUNT = 7;

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'かんたん',
  2: 'ふつう',
  3: 'むずかしい',
  4: '超むずかしい',
};

const DUO_LEVEL_INFO: Record<number, { name: string; time: string; turnTime: string }> = {
  1: { name: 'かんたん',     time: '4分', turnTime: '30秒' },
  2: { name: 'ふつう',      time: '4分', turnTime: '30秒' },
  3: { name: 'むずかしい',  time: '4分', turnTime: '30秒' },
  4: { name: '超むずかしい', time: '5分', turnTime: '45秒' },
};

/**
 * ゲーム画面ページ
 * @description ルームに接続し、待機・プレイ・終了の各フェーズを表示する
 */
export default function Game() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [selectedGameDuration, setSelectedGameDuration] = useState(300);
  const [selectedTurnDuration, setSelectedTurnDuration] = useState(30);
  const [selectedDuoLevel, setSelectedDuoLevel] = useState<1|2|3|4>(1);

  const {
    gameStatus,
    players,
    turn,
    messages,
    turnEndInfo,
    drawQueueRef,
    clearSignal,
    isHost,
    startGame,
    submitAnswer,
    sendDraw,
    sendClear,
    sendAbort,
    abortedBy,
    gameMode,
    myRole,
    consecutiveCorrect,
    judgmentPhase,
    judgmentPlayers,
    judgmentTimeLeft,
    judgmentVotedCount,
    judgmentTotalCount,
    hasVoted,
    werewolfResult,
    sendVote,
    duoCorrectCount,
    duoLevel,
    duoResult,
    connectError,
  } = useGame(roomCode!, user!.id);

  function handleAbort() {
    if (window.confirm('ゲームを中断しますか？\n全員がロビーに戻ります。')) {
      sendAbort();
    }
  }

  const isDrawer = turn?.drawerId === user!.id;

  if (gameStatus === 'connecting') {
    if (connectError) {
      const isNameConflict = connectError.code === 'USERNAME_CONFLICT';
      return (
        <div className="connecting-page">
          <p className="connecting-error" role="alert">{connectError.message}</p>
          {user?.isGuest && isNameConflict ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate('/guest-username', { state: { action: 'join', roomCode } })}
            >
              別の名前で参加する
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={() => navigate('/lobby')}>
              ロビーに戻る
            </button>
          )}
        </div>
      );
    }
    return <div className="connecting-page">接続中...</div>;
  }

  if (gameStatus === 'aborted') {
    return (
      <div className="finished-page">
        <div className="finished-card">
          <div className="finished-icon">🚫</div>
          <h1 className="finished-title">ゲームを中断しました</h1>
          <p className="waiting-hint">{abortedBy} さんがゲームを中断しました</p>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/lobby')}>
            ロビーに戻る
          </button>
        </div>
      </div>
    );
  }

  // ─── デュオモード クリア画面 ─────────────────────────────────────────────────
  if (gameStatus === 'finished' && gameMode === 'duo' && duoResult?.cleared) {
    const tl = duoResult.timeLeft ?? 0;
    const mins = Math.floor(tl / 60);
    const secs = tl % 60;
    return (
      <div className="finished-page">
        <div className="finished-card duo-clear-card">
          <div className="finished-icon">🎉</div>
          <h1 className="finished-title duo-clear-title">ステージクリア！</h1>
          <div className="duo-clear-level">
            {'⭐'.repeat(duoResult.level)} Lv.{duoResult.level} {DUO_LEVEL_INFO[duoResult.level]?.name}
          </div>
          <div className="duo-clear-time">残り時間 {mins}:{String(secs).padStart(2, '0')}</div>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/lobby')}>
            ロビーに戻る
          </button>
        </div>
      </div>
    );
  }

  // ─── デュオモード ゲームオーバー画面 ────────────────────────────────────────
  if (gameStatus === 'finished' && gameMode === 'duo' && duoResult && !duoResult.cleared) {
    return (
      <div className="finished-page">
        <div className="finished-card duo-gameover-card">
          <div className="finished-icon">💔</div>
          <h1 className="finished-title">ゲームオーバー</h1>
          <div className="duo-clear-level">
            {'⭐'.repeat(duoResult.level)} Lv.{duoResult.level} {DUO_LEVEL_INFO[duoResult.level]?.name}
          </div>
          <div className="duo-gameover-count">{duoResult.correctCount} / {DUO_CLEAR_COUNT} 問正解</div>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/lobby')}>
            ロビーに戻る
          </button>
        </div>
      </div>
    );
  }

  // ─── 人狼モード終了画面 ──────────────────────────────────────────────────────
  if (gameStatus === 'finished' && gameMode === 'werewolf' && werewolfResult) {
    const citizensWon = werewolfResult.winner === 'citizens';
    return (
      <div className="finished-page">
        <div className="finished-card werewolf-result-card">
          <div className="finished-icon">{citizensWon ? '🎉' : '🐺'}</div>
          <h1 className="finished-title">
            {citizensWon ? '市民の勝利！' : '人狼の勝利！'}
          </h1>
          <p className="werewolf-reveal">
            人狼は <strong>{werewolfResult.werewolfUsername}</strong> でした
          </p>
          {werewolfResult.votes.length > 0 && (
            <div className="vote-detail-list">
              <div className="vote-detail-header">投票結果</div>
              {werewolfResult.votes.map(v => (
                <div key={v.voterId} className="vote-detail-item">
                  <span className="vote-detail-voter">{v.voterName}</span>
                  <span className="vote-detail-arrow">→</span>
                  <span className="vote-detail-target">{v.targetName ?? '（未投票）'}</span>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-primary" type="button" onClick={() => navigate('/lobby')}>
            ロビーに戻る
          </button>
        </div>
      </div>
    );
  }

  // ─── 通常モード終了画面 ──────────────────────────────────────────────────────
  if (gameStatus === 'finished') {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return (
      <div className="finished-page">
        <div className="finished-card">
          <div className="finished-icon">🏆</div>
          <h1 className="finished-title">ゲーム終了！</h1>
          <ol className="final-scores">
            {sorted.map((p, i) => (
              <li key={p.userId} className="final-score-item">
                <span className="final-score-rank">{i + 1}</span>
                <span className="final-score-name">{p.username}</span>
                <span className="final-score-pts">{p.score}pt</span>
              </li>
            ))}
          </ol>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/lobby')}>
            ロビーに戻る
          </button>
        </div>
      </div>
    );
  }

  // ─── ジャッジメントフェーズ ──────────────────────────────────────────────────
  if (judgmentPhase) {
    return (
      <div className="judgment-page">
        <div className="judgment-card">
          <div className="finished-icon">🗳️</div>
          <h1 className="finished-title">ジャッジメントタイム</h1>
          <p className="waiting-hint">人狼だと思うプレイヤーに投票してください</p>
          <div className="judgment-timer">残り {judgmentTimeLeft} 秒</div>
          <div className="judgment-voted-count">
            {judgmentVotedCount} / {judgmentTotalCount} 人が投票済み
          </div>
          {hasVoted ? (
            <p className="waiting-hint">投票しました。他の人の投票を待っています...</p>
          ) : (
            <div className="judgment-players">
              {judgmentPlayers
                .filter(p => p.userId !== user!.id)
                .map(p => (
                  <button
                    key={p.userId}
                    className="judgment-player-btn"
                    type="button"
                    onClick={() => sendVote(p.userId)}
                  >
                    {p.username}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 待機フェーズ ────────────────────────────────────────────────────────────
  if (gameStatus === 'waiting') {
    const isDuo = (location.state as { isDuoRoom?: boolean } | null)?.isDuoRoom === true;
    // デュオは2人固定で開始可能、通常/人狼は3人以上必要
    const canStart = isDuo ? players.length === 2 : players.length >= 3;
    return (
      <div className="waiting-page">
        <button
          className="btn btn-ghost btn-sm waiting-back-btn"
          type="button"
          onClick={() => navigate('/lobby')}
        >
          ← ロビーに戻る
        </button>
        <div className="waiting-card">
          <div style={{ textAlign: 'center', fontSize: 32 }}>🌲</div>
          <h1 className="waiting-title">ルームコード</h1>
          <p className="waiting-code">{roomCode}</p>
          <p className="waiting-share-hint">このコードを参加者に共有してください</p>
          <Scoreboard players={players} showScore={false} />
          <p className="waiting-hint">
            {isDuo
              ? '2人接続中 — デュオモードで遊べます'
              : `${players.length} 人接続中（ゲーム開始には 3 人以上必要）`}
          </p>
          {isHost ? (
            <>
              {isDuo ? (
                <>
                  <p className="waiting-hint">レベルを選んでスタートしましょう！</p>
                  <div className="duo-level-grid">
                    {([1, 2, 3, 4] as const).map(lv => (
                      <button
                        key={lv}
                        type="button"
                        className={`duo-level-card ${selectedDuoLevel === lv ? 'duo-level-card--selected' : ''}`}
                        onClick={() => setSelectedDuoLevel(lv)}
                      >
                        <div className="duo-level-stars">{'⭐'.repeat(lv)}</div>
                        <div className="duo-level-name">Lv.{lv} {DUO_LEVEL_INFO[lv].name}</div>
                        <div className="duo-level-info">{DUO_LEVEL_INFO[lv].time} / {DUO_LEVEL_INFO[lv].turnTime}ターン</div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mode-selector">
                    <label>
                      <input
                        type="radio"
                        value="normal"
                        checked={selectedMode === 'normal'}
                        onChange={() => setSelectedMode('normal')}
                      />
                      {' '}通常モード
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="werewolf"
                        checked={selectedMode === 'werewolf'}
                        onChange={() => setSelectedMode('werewolf')}
                      />
                      {' '}人狼モード
                    </label>
                  </div>
                  <div className="duration-selector">
                    <div className="duration-group">
                      <span className="duration-label">1ゲームの時間</span>
                      <div className="duration-options">
                        {([180, 240, 300] as const).map((sec) => (
                          <label key={sec}>
                            <input
                              type="radio"
                              value={sec}
                              checked={selectedGameDuration === sec}
                              onChange={() => setSelectedGameDuration(sec)}
                            />
                            {' '}{sec / 60}分
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="duration-group">
                      <span className="duration-label">1ターンの時間</span>
                      <div className="duration-options">
                        {([30, 45, 60] as const).map((sec) => (
                          <label key={sec}>
                            <input
                              type="radio"
                              value={sec}
                              checked={selectedTurnDuration === sec}
                              onChange={() => setSelectedTurnDuration(sec)}
                            />
                            {' '}{sec >= 60 ? `${sec / 60}分` : `${sec}秒`}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
              <button
                className="btn btn-primary btn-full"
                type="button"
                onClick={() => isDuo
                  ? startGame('duo', 0, 0, selectedDuoLevel)
                  : startGame(selectedMode, selectedGameDuration, selectedTurnDuration)
                }
                disabled={!canStart}
              >
                ゲーム開始
              </button>
            </>
          ) : (
            <p className="waiting-hint">ホストがゲームを開始するまでお待ちください...</p>
          )}
        </div>
      </div>
    );
  }

  // ─── プレイフェーズ ──────────────────────────────────────────────────────────
  return (
    <div className="game-layout">
      <header className="game-header">
        <span className="game-header-code">{roomCode}</span>
        {turn && <Timer turnTimeLeft={turn.turnTimeLeft} gameTimeLeft={turn.gameTimeLeft} />}
        <span className="game-header-drawer">
          絵描き：<strong>{turn?.drawerName ?? '—'}</strong>
        </span>
        {gameMode === 'werewolf' && (
          <div className="streak-counter">🔥 {consecutiveCorrect}/5 連続正解</div>
        )}
        {gameMode === 'duo' && (
          <div className="streak-counter">🎯 {duoCorrectCount}/{DUO_CLEAR_COUNT}問</div>
        )}
        <button className="btn btn-ghost btn-sm" type="button" onClick={handleAbort}>
          中断
        </button>
      </header>

      {myRole === 'werewolf' && (
        <div className="werewolf-role-banner">
          <span className="role-title">🐺 あなたは人狼です！</span>
          <span className="role-hint">正体がバレずに、5連続正解を阻止しよう！</span>
        </div>
      )}
      {myRole === 'citizen' && (
        <div className="citizen-role-banner">
          <span className="role-title">👤 あなたは市民です</span>
          <span className="role-hint">仲間と協力して5連続正解を目指せ！</span>
        </div>
      )}

      {isDrawer && turn?.topic && (
        <div className="game-drawer-banner">
          ✏️ あなたが絵描き役です！　お題：{turn.topic}
          {gameMode !== 'normal' && (
            <span className={`difficulty-badge difficulty-badge--${turn.difficulty} difficulty-badge--inline`}>
              {'⭐'.repeat(turn.difficulty)} {DIFFICULTY_LABEL[turn.difficulty]}
            </span>
          )}
        </div>
      )}

      <div className="game-main">
        <div className="game-canvas-area">
          <Canvas
            isDrawer={isDrawer}
            drawQueueRef={drawQueueRef}
            clearSignal={clearSignal}
            onDraw={sendDraw}
            onClear={sendClear}
          />
        </div>
        <div className="game-sidebar">
          {gameMode === 'duo' ? (
            <div className="duo-progress-panel">
              <div className="duo-progress-level">
                {'⭐'.repeat(duoLevel ?? 1)}&nbsp;Lv.{duoLevel}&nbsp;{DUO_LEVEL_INFO[duoLevel ?? 1]?.name}
              </div>
              <div className="duo-progress-count">
                <span className="duo-progress-correct">{duoCorrectCount}</span>
                <span className="duo-progress-sep">/</span>
                <span className="duo-progress-target">{DUO_CLEAR_COUNT}</span>
              </div>
              <div className="duo-progress-bar">
                <div
                  className="duo-progress-bar-fill"
                  style={{ width: `${Math.min((duoCorrectCount / DUO_CLEAR_COUNT) * 100, 100)}%` }}
                />
              </div>
              <p className="duo-progress-hint">{DUO_CLEAR_COUNT}問正解でクリア！</p>
            </div>
          ) : gameMode !== 'werewolf' ? (
            <>
              <Scoreboard players={players} drawerId={turn?.drawerId} />
              <div className="score-ref">
                <div className="score-ref-title">得点表</div>
                <div className="score-ref-row">
                  <span>正解</span>
                  <span className="score-ref-pts score-ref-pts--plus">回答者 ＋3 / 描き手 ＋2</span>
                </div>
                <div className="score-ref-row">
                  <span>正解なし</span>
                  <span className="score-ref-pts score-ref-pts--minus">描き手 −2</span>
                </div>
              </div>
            </>
          ) : null}
          <Chat messages={messages} isDrawer={isDrawer} onSubmit={submitAnswer} />
        </div>
      </div>

      {turnEndInfo && (
        <div className="overlay">
          <div className="overlay-card">
            {turnEndInfo.correct ? (
              <>
                <div className="overlay-icon">✅</div>
                <p className={`overlay-title overlay-title--correct`}>
                  {turnEndInfo.correct.username} が正解！
                </p>
              </>
            ) : (
              <>
                <div className="overlay-icon">⏰</div>
                <p className="overlay-title overlay-title--timeout">時間切れ</p>
              </>
            )}
            <p className="overlay-topic">
              お題：<strong>{turnEndInfo.topic}</strong>
            </p>
            <p className="overlay-next">次のターンに移ります...</p>
          </div>
        </div>
      )}
    </div>
  );
}
