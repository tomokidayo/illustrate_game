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
  } = useGame(roomCode!, user!.id);

  const isDrawer = turn?.drawerId === user!.id;

  if (gameStatus === 'connecting') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text)' }}>
        接続中...
      </div>
    );
  }

  if (gameStatus === 'finished') {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h1 style={{ marginBottom: 24 }}>ゲーム終了！</h1>
        <div style={{ maxWidth: 360, margin: '0 auto', textAlign: 'left' }}>
          <h2 style={{ marginBottom: 12 }}>最終スコア</h2>
          <ol style={{ padding: '0 0 0 20px', margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map((p, i) => (
              <li key={p.userId} style={{ fontSize: 16, color: i === 0 ? 'var(--accent)' : 'var(--text-h)' }}>
                {p.username}
                <span style={{ float: 'right', fontWeight: 700 }}>{p.score}pt</span>
              </li>
            ))}
          </ol>
        </div>
        <button
          type="button"
          onClick={() => navigate('/lobby')}
          style={{
            marginTop: 32,
            padding: '10px 28px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ロビーに戻る
        </button>
      </div>
    );
  }

  if (gameStatus === 'waiting') {
    const canStart = players.length >= 3;
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h1>ルーム：{roomCode}</h1>
        <div style={{ maxWidth: 360, margin: '0 auto', textAlign: 'left' }}>
          <Scoreboard players={players} />
        </div>
        <p style={{ color: 'var(--text)', margin: '16px 0', fontSize: 14 }}>
          {players.length} 人接続中（ゲーム開始には 3 人以上必要）
        </p>
        {isHost && (
          <button
            type="button"
            onClick={startGame}
            disabled={!canStart}
            style={{
              padding: '10px 28px',
              background: canStart ? 'var(--accent)' : 'var(--border)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: canStart ? 'pointer' : 'not-allowed',
            }}
          >
            ゲーム開始
          </button>
        )}
        {!isHost && (
          <p style={{ color: 'var(--text)', fontSize: 14 }}>ホストがゲームを開始するまでお待ちください...</p>
        )}
      </div>
    );
  }

  // playing フェーズ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', boxSizing: 'border-box' }}>
      {/* ヘッダー：タイマー */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-h)' }}>
          ルーム：{roomCode}
        </span>
        {turn && (
          <Timer turnTimeLeft={turn.turnTimeLeft} gameTimeLeft={turn.gameTimeLeft} />
        )}
        <span style={{ fontSize: 14, color: 'var(--text)' }}>
          絵描き：{turn?.drawerName ?? '—'}
        </span>
      </header>

      {/* 絵描き役バナー */}
      {isDrawer && turn?.topic && (
        <div
          style={{
            background: 'var(--accent-bg)',
            borderBottom: '1px solid var(--accent-border)',
            padding: '8px 20px',
            textAlign: 'center',
            fontSize: 15,
            color: 'var(--accent)',
            fontWeight: 600,
          }}
        >
          あなたが絵描き役です！　お題：{turn.topic}
        </div>
      )}

      {/* メインエリア */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* キャンバスエリア */}
        <div
          style={{
            flex: '0 0 auto',
            padding: 16,
            display: 'flex',
            alignItems: 'flex-start',
          }}
        >
          <Canvas
            isDrawer={isDrawer}
            drawQueueRef={drawQueueRef}
            clearSignal={clearSignal}
            onDraw={sendDraw}
            onClear={sendClear}
          />
        </div>

        {/* サイドバー：スコアボード + チャット */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid var(--border)',
            minWidth: 220,
            maxWidth: 320,
            minHeight: 0,
          }}
        >
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            <Scoreboard players={players} drawerId={turn?.drawerId} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Chat
              messages={messages}
              isDrawer={isDrawer}
              onSubmit={submitAnswer}
            />
          </div>
        </div>
      </div>

      {/* ターン終了オーバーレイ */}
      {turnEndInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '32px 48px',
              textAlign: 'center',
              boxShadow: 'var(--shadow)',
              minWidth: 280,
            }}
          >
            {turnEndInfo.correct ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#16a34a', margin: '0 0 4px' }}>
                  {turnEndInfo.correct.username} が正解！
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 8 }}>⏰</div>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', margin: '0 0 4px' }}>
                  時間切れ
                </p>
              </>
            )}
            <p style={{ fontSize: 15, color: 'var(--text)', margin: '8px 0 0' }}>
              お題：<strong style={{ color: 'var(--text-h)' }}>{turnEndInfo.topic}</strong>
            </p>
            <p style={{ fontSize: 13, color: 'var(--text)', marginTop: 16 }}>次のターンに移ります...</p>
          </div>
        </div>
      )}
    </div>
  );
}
