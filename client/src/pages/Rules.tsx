import { useNavigate } from 'react-router-dom';

/**
 * ゲームルール説明ページ
 */
export default function Rules() {
  const navigate = useNavigate();

  return (
    <div className="rules-page">
      <header className="lobby-header">
        <div className="lobby-header-logo">🌲 お絵描きの森</div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigate('/lobby')}>
          ← ロビーに戻る
        </button>
      </header>

      <main className="rules-main">
        <h1 className="rules-title">ゲームのルール</h1>

        <section className="rules-card">
          <h2 className="rules-section-title">📋 基本情報</h2>
          <ul className="rules-list">
            <li>プレイ人数：<strong>3〜6人</strong></li>
            <li>ゲーム時間：<strong>5分</strong></li>
            <li>1ターン：<strong>最大30秒</strong>（正解が出たら即終了）</li>
            <li>お題はひらがなで統一されています</li>
          </ul>
        </section>

        <section className="rules-card">
          <h2 className="rules-section-title">🎮 遊び方</h2>
          <ol className="rules-steps">
            <li>ロビーでルームを作成するか、部屋番号を入力して参加します。</li>
            <li>3人以上集まったら、ホストが「ゲーム開始」ボタンを押します。</li>
            <li>1人が<strong>絵描き役</strong>に選ばれ、お題の絵をキャンバスに描きます。絵描き役だけがお題を知っています。</li>
            <li>他のプレイヤーはチャット欄に答えを入力して回答します。</li>
            <li>正解が出るか30秒経ったら、次のプレイヤーに絵描き役が交代します。</li>
            <li>5分経過するとゲーム終了。最も得点が高いプレイヤーの勝ちです！</li>
          </ol>
        </section>

        <section className="rules-card">
          <h2 className="rules-section-title">🏆 得点ルール</h2>
          <table className="rules-table">
            <thead>
              <tr>
                <th>状況</th>
                <th>対象</th>
                <th>得点</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td rowSpan={2}>正解が出た</td>
                <td>正解した回答者</td>
                <td className="rules-score rules-score--plus">＋3点</td>
              </tr>
              <tr>
                <td>絵描き役</td>
                <td className="rules-score rules-score--plus">＋2点</td>
              </tr>
              <tr>
                <td>時間切れ（正解なし）</td>
                <td>絵描き役</td>
                <td className="rules-score rules-score--minus">−2点</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="rules-card">
          <h2 className="rules-section-title">💡 その他のルール</h2>
          <ul className="rules-list">
            <li>絵描き役は回答できません。</li>
            <li>ゲーム中はいつでも「中断」ボタンでゲームを終了できます（得点は保存されません）。</li>
            <li>途中で切断しても再接続するとゲームに復帰できます。</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
