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

        {/* ── 共通 ── */}
        <section className="rules-card">
          <h2 className="rules-section-title">📋 基本情報（共通）</h2>
          <ul className="rules-list">
            <li>プレイ人数：<strong>3〜6人</strong></li>
            <li>ゲーム時間：<strong>5分</strong></li>
            <li>1ターン：<strong>最大30秒</strong>（正解が出たら即終了）</li>
            <li>お題は漢字・カタカナ・ひらがなで出題されます。どの表記で回答しても正解になります。</li>
          </ul>
        </section>

        {/* ── 通常モード ── */}
        <div className="rules-mode-label rules-mode-label--normal">🎮 通常モード</div>

        <section className="rules-card">
          <h2 className="rules-section-title">遊び方</h2>
          <ol className="rules-steps">
            <li>ロビーでルームを作成するか、部屋番号を入力して参加します。</li>
            <li>3人以上集まったら、ホストがモードを「通常モード」にして「ゲーム開始」を押します。</li>
            <li>1人が<strong>絵描き役</strong>に選ばれ、お題の絵をキャンバスに描きます。絵描き役だけがお題を知っています。</li>
            <li>他のプレイヤーはチャット欄に答えを入力して回答します。</li>
            <li>正解が出るか30秒経ったら、次のプレイヤーに絵描き役が交代します。</li>
            <li>5分経過するとゲーム終了。最も得点が高いプレイヤーの勝ちです！</li>
          </ol>
        </section>

        <section className="rules-card">
          <h2 className="rules-section-title">得点ルール</h2>
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

        {/* ── 人狼モード ── */}
        <div className="rules-mode-label rules-mode-label--werewolf">🐺 人狼モード</div>

        <section className="rules-card">
          <h2 className="rules-section-title">概要</h2>
          <ul className="rules-list">
            <li>ゲーム開始時、ランダムで1人が<strong>人狼</strong>に選ばれます（本人のみに通知）。残りは<strong>市民</strong>です。</li>
            <li>得点はなく、<strong>チームの勝敗</strong>のみで結果が決まります。</li>
            <li>人狼は正体を隠しながら市民の正解を妨害しましょう。市民は誰が人狼かを見抜きましょう。</li>
          </ul>
        </section>

        <section className="rules-card">
          <h2 className="rules-section-title">勝利条件</h2>
          <table className="rules-table">
            <thead>
              <tr>
                <th>チーム</th>
                <th>勝利条件</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td rowSpan={2}><strong>市民</strong></td>
                <td>① 5ターン連続で正解者が出た場合（即終了・人狼発表）</td>
              </tr>
              <tr>
                <td>② ゲーム終了後のジャッジメントタイムで過半数が人狼を当てた場合</td>
              </tr>
              <tr>
                <td><strong>人狼</strong></td>
                <td>上記①②どちらも達成されなかった場合</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="rules-card">
          <h2 className="rules-section-title">🗳️ ジャッジメントタイム</h2>
          <ol className="rules-steps">
            <li>5分経過するとジャッジメントタイム（30秒）が始まります。</li>
            <li>全員が同時に「人狼だと思うプレイヤー」に1票投票します（自分自身には投票不可）。</li>
            <li>過半数の票を得たプレイヤーが人狼なら<strong>市民の勝利</strong>。</li>
            <li>票が割れた場合は人狼の票を除いて再集計します。それでも割れた場合は<strong>人狼の勝利</strong>。</li>
            <li>30秒経過しても投票が揃わない場合は、その時点の票で集計します。</li>
          </ol>
        </section>

        {/* ── 共通その他 ── */}
        <section className="rules-card">
          <h2 className="rules-section-title">💡 その他のルール（共通）</h2>
          <ul className="rules-list">
            <li>絵描き役は回答できません。</li>
            <li>ゲーム中はいつでも「中断」ボタンでゲームを終了できます（得点・勝敗は保存されません）。</li>
            <li>途中で切断しても再接続するとゲームに復帰できます。</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
