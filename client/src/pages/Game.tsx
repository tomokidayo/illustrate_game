import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../hooks/useGame';
import Canvas from '../components/Canvas';
import Chat from '../components/Chat';
import Timer from '../components/Timer';
import Scoreboard from '../components/Scoreboard';

/**
 * ゲーム画面ページ
 * @description ルームに接続し、待機・プレイ・終了の各フェーズを表示する
 */
export default function Game() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

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
  } = useGame(roomCode!, user!.id);

  function handleAbort() {
    if (window.confirm('ゲームを中断しますか？\n全員がロビーに戻ります。')) {
      sendAbort();
    }
  }

  const isDrawer = turn?.drawerId === user!.id;

  if (gameStatus === 'connecting') {
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

  if (gameStatus === 'waiting') {
    const canStart = players.length >= 3;
    return (
      <div className="waiting-page">
        <div className="waiting-card">
          <div style={{ textAlign: 'center', fontSize: 32 }}>🌲</div>
          <h1 className="waiting-title">ルーム</h1>
          <p className="waiting-code">{roomCode}</p>
          <Scoreboard players={players} />
          <p className="waiting-hint">
            {players.length} 人接続中（ゲーム開始には 3 人以上必要）
          </p>
          {isHost ? (
            <button
              className="btn btn-primary btn-full"
              type="button"
              onClick={startGame}
              disabled={!canStart}
            >
              ゲーム開始
            </button>
          ) : (
            <p className="waiting-hint">ホストがゲームを開始するまでお待ちください...</p>
          )}
        </div>
      </div>
    );
  }

  // playing フェーズ
  return (
    <div className="game-layout">
      <header className="game-header">
        <span className="game-header-code">{roomCode}</span>
        {turn && <Timer turnTimeLeft={turn.turnTimeLeft} gameTimeLeft={turn.gameTimeLeft} />}
        <span className="game-header-drawer">
          絵描き：<strong>{turn?.drawerName ?? '—'}</strong>
        </span>
        <button className="btn btn-ghost btn-sm" type="button" onClick={handleAbort}>
          中断
        </button>
      </header>

      {isDrawer && turn?.topic && (
        <div className="game-drawer-banner">
          ✏️ あなたが絵描き役です！　お題：{turn.topic}
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
