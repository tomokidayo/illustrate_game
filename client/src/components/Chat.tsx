import { useEffect, useRef, useState, FormEvent } from 'react';
import { ChatMessage } from '../hooks/useGame';

/** Chat コンポーネントの Props */
export interface ChatProps {
  /** 表示するメッセージ一覧 */
  messages: ChatMessage[];
  /** true のとき入力欄を非表示にする */
  isDrawer: boolean;
  /** 回答を送信するコールバック */
  onSubmit: (answer: string) => void;
}

/**
 * 回答チャット欄コンポーネント
 * @description メッセージの表示と回答の送信を行う
 */
export default function Chat({ messages, isDrawer, onSubmit }: ChatProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setInput('');
  }

  function renderMessage(msg: ChatMessage) {
    if (msg.kind === 'correct') {
      return (
        <div
          key={msg.id}
          style={{ color: '#16a34a', fontWeight: 600, padding: '2px 0' }}
        >
          ✅ {msg.username} が正解！
        </div>
      );
    }
    if (msg.kind === 'system') {
      return (
        <div
          key={msg.id}
          style={{ color: 'var(--text)', fontStyle: 'italic', fontSize: 13, padding: '2px 0' }}
        >
          {msg.text}
        </div>
      );
    }
    return (
      <div key={msg.id} style={{ padding: '2px 0', fontSize: 14 }}>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{msg.username}</span>
        {'：'}
        {msg.text}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          borderBottom: isDrawer ? 'none' : '1px solid var(--border)',
        }}
      >
        {messages.map(renderMessage)}
      </div>
      {!isDrawer && (
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', padding: '8px', gap: 6 }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="回答を入力..."
            style={{
              flex: 1,
              padding: '6px 10px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              outline: 'none',
              color: 'var(--text-h)',
              background: 'var(--bg)',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '6px 14px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            送信
          </button>
        </form>
      )}
    </div>
  );
}
