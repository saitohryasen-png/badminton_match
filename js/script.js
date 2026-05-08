let players = [];
let stats = {}; // name -> { playCount, restCount }
let pairHistory = {}; // "A|B" -> count
let matchHistory = [];

const nameInput = document.getElementById('name-input');
const playerListEl = document.getElementById('player-list');
const playerCount = document.getElementById('player-count');
const matchBtn = document.getElementById('match-btn');
const resultArea = document.getElementById('result-area');
const warnArea = document.getElementById('warn-area');

nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(); });
nameInput.addEventListener('focus', () => {
  setTimeout(() => nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
});

function pairKey(a, b) { return [a, b].sort().join('|'); }

function getPairCount(a, b) { return pairHistory[pairKey(a, b)] || 0; }

function addPlayer() {
  const name = nameInput.value.trim();
  if (!name || players.length >= 6) return;
  if (players.includes(name)) {
    nameInput.style.borderColor = 'var(--color-border-danger)';
    setTimeout(() => nameInput.style.borderColor = '', 1000);
    return;
  }
  players.push(name);
  stats[name] = { playCount: 0, restCount: 0 };
  nameInput.value = '';
  nameInput.focus();
  setTimeout(() => nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  render();
}

function removePlayer(i) {
  const name = players[i];
  players.splice(i, 1);
  delete stats[name];
  render();
}

function resetAll() {
  players.forEach(p => { stats[p] = { playCount: 0, restCount: 0 }; });
  pairHistory = {};
  matchHistory = [];
  warnArea.innerHTML = '';
  resultArea.innerHTML = '';
  matchBtn.innerHTML = '<i class="ti ti-refresh" aria-hidden="true"></i> 対戦を抽選する';
  render();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 4人からペアを作る全組み合わせ: (0,1)vs(2,3) / (0,2)vs(1,3) / (0,3)vs(1,2)
function allPairings(four) {
  return [
    { teamA: [four[0], four[1]], teamB: [four[2], four[3]] },
    { teamA: [four[0], four[2]], teamB: [four[1], four[3]] },
    { teamA: [four[0], four[3]], teamB: [four[1], four[2]] },
  ];
}

function pairingScore(pairing) {
  // ペア過去回数の合計が少ないほど良い
  const { teamA, teamB } = pairing;
  return getPairCount(teamA[0], teamA[1]) + getPairCount(teamB[0], teamB[1]);
}

function generateMatch() {
  const n = players.length;

  // 出場回数が少ない順 → 同数はシャッフルで公平に
  const shuffled = shuffle(players);
  shuffled.sort((a, b) => stats[a].playCount - stats[b].playCount);

  const playing = shuffled.slice(0, 4);
  const bench = shuffled.slice(4);

  // 3通りのペアリングからスコア最小を選ぶ（同スコアはランダム）
  const pairings = shuffle(allPairings(playing)); // シャッフルで同点時の偏りをなくす
  pairings.sort((a, b) => pairingScore(a) - pairingScore(b));
  const best = pairings[0];
  const { teamA, teamB } = best;

  const isNewPairA = getPairCount(teamA[0], teamA[1]) === 0;
  const isNewPairB = getPairCount(teamB[0], teamB[1]) === 0;

  // 全ペアが既出の場合は警告
  const allUsed = pairings.every(p => pairingScore(p) > 0);

  // 統計更新
  playing.forEach(p => { stats[p].playCount++; stats[p].restCount = 0; });
  bench.forEach(p => { stats[p].restCount++; });
  pairHistory[pairKey(teamA[0], teamA[1])] = (pairHistory[pairKey(teamA[0], teamA[1])] || 0) + 1;
  pairHistory[pairKey(teamB[0], teamB[1])] = (pairHistory[pairKey(teamB[0], teamB[1])] || 0) + 1;

  matchHistory.unshift({ teamA, teamB, bench, isNewPairA, isNewPairB, allUsed });
  if (matchHistory.length > 8) matchHistory.pop();

  warnArea.innerHTML = allUsed
    ? `<div class="warn-box"><i class="ti ti-alert-triangle" style="font-size:16px; flex-shrink:0; margin-top:1px;" aria-hidden="true"></i><span>全ての組み合わせが一度使われました。最もペアの重複が少ない組み合わせを選びました。</span></div>`
    : '';

  render();
  renderResults();
  matchBtn.innerHTML = '<i class="ti ti-refresh" aria-hidden="true"></i> もう一度抽選する';
}

function render() {
  playerCount.textContent = `(${players.length}/6)`;
  matchBtn.disabled = players.length < 4;

  if (players.length === 0) {
    playerListEl.innerHTML = '<div class="empty-state">選手を追加してください</div>';
    return;
  }

  playerListEl.innerHTML = players.map((p, i) => {
    const s = stats[p];
    const total = s.playCount + s.restCount;
    return `
    <div class="player-chip">
      <div class="name">
        <div class="num">${i + 1}</div>
        <span>${p}</span>
      </div>
      <div style="display:flex; align-items:center;">
        <div class="stat-pills">
          ${total > 0 ? `<span class="stat-pill pill-play">出場 ${s.playCount}</span>` : ''}
          ${s.restCount > 0 ? `<span class="stat-pill pill-rest">連続休み ${s.restCount}</span>` : ''}
        </div>
        <button class="remove-btn" onclick="removePlayer(${i})" aria-label="${p}を削除">
          <i class="ti ti-x" style="font-size:16px;" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderResults() {
  if (matchHistory.length === 0) { resultArea.innerHTML = ''; return; }
  resultArea.innerHTML = matchHistory.map((m, idx) => `
    <div class="result-card">
      <div class="result-header">
        <span>${idx === 0 ? '🏸 最新の対戦' : `${idx + 1}回前`}</span>
        <span style="font-size:12px; color:var(--color-text-tertiary);">履歴 ${matchHistory.length}件</span>
      </div>
      <div class="match-body">
        <div class="team team-a left">
          ${m.teamA.map(p => `<div class="player-tag">${p}</div>`).join('')}
          ${idx === 0 && m.isNewPairA ? `<span class="new-badge">初ペア</span>` : ''}
        </div>
        <div class="vs-badge">VS</div>
        <div class="team team-b right">
          ${m.teamB.map(p => `<div class="player-tag">${p}</div>`).join('')}
          ${idx === 0 && m.isNewPairB ? `<span class="new-badge" style="align-self:flex-end;">初ペア</span>` : ''}
        </div>
      </div>
      ${m.bench.length > 0 ? `
        <div class="bench-section">
          <span class="bench-label">控え</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${m.bench.map(p => `<span class="bench-chip">${p}</span>`).join('')}
          </div>
        </div>` : ''}
    </div>
  `).join('');
}

render();