import { useEffect, useRef, RefObject, TouchEvent } from 'react';
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
 * - drawer: マウス・タッチイベントで描画し onDraw を呼ぶ
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
  }, [clearSignal]);

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
      while (queue.length > 0) draw(queue.shift()!);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawQueueRef]);

  /** CSS でスケールされたキャンバス座標をキャンバス内座標に変換する */
  function getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CANVAS_WIDTH / rect.width),
      y: (clientY - rect.top) * (CANVAS_HEIGHT / rect.height),
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawer) return;
    isPenDownRef.current = true;
    const { x, y } = getCanvasPos(e.clientX, e.clientY);
    lastXRef.current = x;
    lastYRef.current = y;
    onDraw({ x, y, dragging: false, color, width: lineWidth });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawer || !isPenDownRef.current) return;
    const { x, y } = getCanvasPos(e.clientX, e.clientY);
    onDraw({ x, y, dragging: true, color, width: lineWidth });
    lastXRef.current = x;
    lastYRef.current = y;
  }

  function handleMouseUp() { isPenDownRef.current = false; }
  function handleMouseLeave() { isPenDownRef.current = false; }

  function handleTouchStart(e: TouchEvent<HTMLCanvasElement>) {
    if (!isDrawer) return;
    e.preventDefault();
    isPenDownRef.current = true;
    const touch = e.touches[0];
    const { x, y } = getCanvasPos(touch.clientX, touch.clientY);
    lastXRef.current = x;
    lastYRef.current = y;
    onDraw({ x, y, dragging: false, color, width: lineWidth });
  }

  function handleTouchMove(e: TouchEvent<HTMLCanvasElement>) {
    if (!isDrawer || !isPenDownRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = getCanvasPos(touch.clientX, touch.clientY);
    onDraw({ x, y, dragging: true, color, width: lineWidth });
    lastXRef.current = x;
    lastYRef.current = y;
  }

  function handleTouchEnd() { isPenDownRef.current = false; }

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className={`canvas-el ${isDrawer ? 'canvas-el--drawer' : 'canvas-el--viewer'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {isDrawer && (
        <button className="btn btn-ghost btn-sm" type="button" onClick={onClear}>
          クリア
        </button>
      )}
    </div>
  );
}
