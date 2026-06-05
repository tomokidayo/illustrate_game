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
      return <div key={msg.id} className="chat-msg chat-msg--correct">✅ {msg.username} が正解！</div>;
    }
    if (msg.kind === 'system') {
      return <div key={msg.id} className="chat-msg chat-msg--system">{msg.text}</div>;
    }
    return (
      <div key={msg.id} className="chat-msg chat-msg--wrong">
        <span className="chat-msg-name">{msg.username}</span>：{msg.text}
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat-messages" ref={listRef}>
        {messages.map(renderMessage)}
      </div>
      {!isDrawer && (
        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            className="chat-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="回答を入力..."
          />
          <button className="btn btn-primary btn-sm" type="submit">送信</button>
        </form>
      )}
    </div>
  );
}
