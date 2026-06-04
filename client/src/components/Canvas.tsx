import { useEffect, useRef, RefObject } from 'react';
import { DrawData } from '../hooks/useGame';

/** Canvas コンポーネントの Props */
export interface CanvasProps {
  /** true のとき描画操作が有効になる */
  isDrawer: boolean;
  /** リモートから届いた描画コマンドのキュー（drawer の自己描画も含む） */
  drawQueueRef: RefObject<DrawData[]>;
  /** 値が変わるたびキャンバスをクリアする */
  clearSignal: number;
  /** drawer が描いたときに呼ばれるコールバック */
  onDraw: (data: Omit<DrawData, 'roomCode'>) => void;
  /** drawer がクリアしたときに呼ばれるコールバック */
  onClear: () => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

/**
 * お絵描きキャンバスコンポーネント
 * - drawer: マウスイベントで描画し onDraw を呼ぶ
 * - 全員: drawQueueRef を rAF ループで消費しキャンバスに描画する
 */
export default function Canvas({ isDrawer, drawQueueRef, clearSignal, onDraw, onClear }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPenDownRef = useRef(false);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const rafRef = useRef<number>(0);

  const color = '#222222';
  const lineWidth = 3;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, []);

  // clearSignal が変わるたびキャンバスをリセットする
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, [clearSignal]);

  // rAF ループで drawQueueRef を消費し描画する
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw(item: DrawData) {
      if (!ctx) return;
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (!item.dragging) {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(lastXRef.current, lastYRef.current);
        ctx.lineTo(item.x, item.y);
        ctx.stroke();
      }
      lastXRef.current = item.x;
      lastYRef.current = item.y;
    }

    function loop() {
      const queue = drawQueueRef.current;
      while (queue.length > 0) {
        draw(queue.shift()!);
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawQueueRef]);

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawer) return;
    isPenDownRef.current = true;
    const { x, y } = getPos(e);
    lastXRef.current = x;
    lastYRef.current = y;
    onDraw({ x, y, dragging: false, color, width: lineWidth });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawer || !isPenDownRef.current) return;
    const { x, y } = getPos(e);
    onDraw({ x, y, dragging: true, color, width: lineWidth });
    lastXRef.current = x;
    lastYRef.current = y;
  }

  function handleMouseUp() {
    isPenDownRef.current = false;
  }

  function handleMouseLeave() {
    isPenDownRef.current = false;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          cursor: isDrawer ? 'crosshair' : 'default',
          background: '#fff',
          display: 'block',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      {isDrawer && (
        <button
          type="button"
          onClick={onClear}
          style={{
            alignSelf: 'flex-start',
            padding: '4px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          クリア
        </button>
      )}
    </div>
  );
}
