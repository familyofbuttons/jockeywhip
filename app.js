/* Jockey Whip Races — full app logic
   - Brand set to "Jockey Whip Races"
   - Loads header icon from assets/jockey-icon.png by default
   - Underdog upset behavior included so winners are less predictable
   - Meetings run RACES_PER_MEETING races
   - Odds removed from animation visuals where requested
   - Bets, players, and UI behavior preserved
*/

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const GAME_TITLE = 'Jockey Whip Races';
  document.title = GAME_TITLE;

  // ICON helper: change path if you saved the icon elsewhere
  const ICON_PATH = 'assets/jockey-icon.png';
  const brandIconEl = document.getElementById('brandIcon');
  if (brandIconEl) {
    brandIconEl.src = ICON_PATH;
    brandIconEl.addEventListener('error', () => {
      brandIconEl.style.display = 'none';
    });
  }

  const START_BANKROLL = 100;
  const MIN_BET = 5;
  const RACES_PER_MEETING = 6;

  // -----------------------
  // Underdog upset tuning
  // -----------------------
  // Base chance (per horse) that an upset boost may be applied in a race.
  // Keep small (e.g., 0.02 = 2%) so upsets are occasional.
  const UNDERDOG_BASE_BOOST_RATE = 0.02;

  // Multiplier applied to boost probability for the worst horse relative to the best.
  // Higher values make underdogs much more likely than favorites to receive a boost.
  const UNDERDOG_BOOST_MULTIPLIER = 4.0;

  // Size of the boost added to the horse's performance score when an upset occurs.
  const UNDERDOG_BOOST_MIN = 6;
  const UNDERDOG_BOOST_MAX = 18;

  // Soft cap on total number of boosted horses per race to avoid too many simultaneous upsets.
  const MAX_BOOSTED_PER_RACE = 2;

  // -----------------------
  // End tuning
  // -----------------------

  const MEETINGS = [
    { id: 'ascot', name: 'Ascot', color: '#0b3d91', theme: { primary: '#0b3d91' } },
    { id: 'aintree', name: 'Aintree', color: '#0b3f1f', theme: { primary: '#0b3f1f' } },
    { id: 'dubai', name: 'Dubai', color: '#0f766e', theme: { primary: '#0f766e' } },
    { id: 'cheltenham', name: 'Cheltenham', color: '#1f2937', theme: { primary: '#1f2937' } },
    { id: 'newmarket', name: 'Newmarket', color: '#0b6b3a', theme: { primary: '#0b6b3a' } },
    { id: 'goodwood', name: 'Goodwood', color: '#6b21a8', theme: { primary: '#6b21a8' } },
    { id: 'tokyo', name: 'Tokyo', color: '#b91c1c', theme: { primary: '#b91c1c' } }
  ];

  const DEFAULT_PLACE_TERMS = [
    { min: 0, max: 3, places: 0, frac: 0 },
    { min: 4, max: 7, places: 1, frac: 0.25 },
    { min: 8, max: 11, places: 2, frac: 0.25 },
    { min: 12, max: 1000, places: 3, frac: 0.2 }
  ];

  const COMMON_FRACTIONS = [
    { s: '1/4', v: 1.25 }, { s: '1/3', v: 1.3333 }, { s: '1/2', v: 1.5 },
    { s: '2/5', v: 1.4 }, { s: '1/1', v: 2.0 }, { s: '3/2', v: 2.5 },
    { s: '2/1', v: 3.0 }, { s: '5/2', v: 3.5 }, { s: '3/1', v: 4.0 },
    { s: '4/1', v: 5.0 }, { s: '5/1', v: 6.0 }, { s: '6/1', v: 7.0 },
    { s: '8/1', v: 9.0 }, { s: '10/1', v: 11.0 }, { s: '12/1', v: 13.0 },
    { s: '16/1', v: 17.0 }, { s: '20/1', v: 21.0 }, { s: '33/1', v: 34.0 }
  ];

  const FIRST = ['Captain','Mango','Pancake','Sir','Lady','Golden','Chorizo','Swift','Mighty','Lucky','Brave','Storm','Silver','Old','Quick','Bold','Sunny','Shadow','Olive','Biscuit','Toffee','Curry','Saffron','Ginger','Maple'];
  const SECOND = ['Parsnip','Whinny','Rocket','Biscuit','Thunder','Sprout','Comet','Duke','Pippin','Rascal','Bolt','Gadget','Marquis','Breeze','Harper','Milo','Ruby','Finn','Nora','Theo','Lola','Sam','Ivy','Oscar','Mabel','Allen','Gray'];
  const TRAINERS = ['M. Trotter','D. Hargreaves','F. O’Leary','S. McGinty','A. Patel','L. O\'Connor','R. Singh','P. Brown','C. Evans','G. Smith','H. Baker','J. Rivera'];

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const rand = () => Math.random();

  const STORAGE_KEY = 'racecraft_v0_6_1';
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || null; }
    catch (e) { return null; }
  }
  function saveState(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch(e){} }

  const MEETING_COUNT_KEY = 'racecraft_meeting_counts_v0_6_1';
  function loadMeetingCounts() {
    try { return JSON.parse(localStorage.getItem(MEETING_COUNT_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveMeetingCounts(c) { try { localStorage.setItem(MEETING_COUNT_KEY, JSON.stringify(c)); } catch(e){} }

  const defaultState = { meetingId: MEETINGS[1].id, players: [], rollover: true, ui: { activePlayer: null } };
  let state = Object.assign({}, defaultState, loadState() || {});
  let meetingCounts = loadMeetingCounts();

  if (!state.players || !state.players.length) {
    state.players = [{ id: 'p1', name: 'Player 1', bankroll: START_BANKROLL, bets: [] }];
    state.ui.activePlayer = state.players[0].id;
  }

  const $ = id => document.getElementById(id);

  const brandEl = document.querySelector('.brand');
  if (brandEl) brandEl.textContent = GAME_TITLE;

  const meetingTitle = $('meetingTitle');
  const raceInfo = $('raceInfo');
  const raceMeta = $('raceMeta');

  const playersList = $('playersList');
  const addPlayerBtn = $('addPlayerBtn');
  const resetPlayersBtn = $('resetPlayersBtn');

  const betHorse = $('betHorse');
  const betType = $('betType');
  const betStake = $('betStake');
  const stakeMinus = $('stakeMinus');
  const stakePlus = $('stakePlus');
  const betCost = $('betCost');
  const betEstimate = $('betEstimate');
  const placeBetBtn = $('placeBetBtn');
  const nextPlayerBtn = $('nextPlayerBtn');
  const activePlayerName = $('activePlayerName');

  const betsBox = $('betsBox');

  const racecardList = $('racecardList');

  const startRaceBtn = $('startRaceBtn');
  const replayBtn = $('replayBtn');
  const fastBtn = $('fastBtn');
  const nextRaceBtn = $('nextRaceBtn');
  const newMeetingBtn = $('newMeetingBtn');

  const canvas = $('raceCanvas');
  const ctx = canvas.getContext('2d');

  const settlementModal = $('settlementModal');
  const settlementList = $('settlementList');
  const settlementOk = $('settlementOk');

  const meetingOverlay = $('meetingOverlay');
  const overlayCard = $('overlayCard');
  const mainGrid = $('mainGrid');

  function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }
  function getMeeting(){ return MEETINGS.find(m => m.id === state.meetingId) || MEETINGS[1]; }
  function setActivePlayer(id){ state.ui.activePlayer = id; saveState(state); renderPlayers(); updateBetUI(); }
  function getActivePlayer(){ return state.players.find(p => p.id === state.ui.activePlayer) || state.players[0]; }
  function formatMoney(n){ return '£' + n.toFixed(2); }

  function decimalToCommonFraction(decimal) {
    let best = COMMON_FRACTIONS[0];
    let minErr = Math.abs(decimal - best.v);
    for (const f of COMMON_FRACTIONS) {
      const err = Math.abs(decimal - f.v);
      if (err < minErr) { minErr = err; best = f; }
    }
    return best.s;
  }

  function generateClothColor(index) {
    return `hsl(${(index * 37) % 360} 72% 48%)`;
  }

  // -----------------------
  // genHorse / genRace
  // -----------------------
  function genHorse(index) {
    const name = `${FIRST[randInt(0,FIRST.length-1)]} ${SECOND[randInt(0,SECOND.length-1)]}`;
    const trainer = TRAINERS[randInt(0,TRAINERS.length-1)];
    const age = randInt(3,10);
    const speed = randInt(55,95);
    const stamina = randInt(45,95);
    const jumpSkill = randInt(55,95);
    const consistency = randInt(40,90);
    const formBias = randInt(-6,6);
    const color = generateClothColor(index);
    return { id: uid('h'), name, trainer, age, speed, stamina, jumpSkill, consistency, formBias, color, recent: [], position: null };
  }

  function genRace(numRunners) {
    const runnersCount = numRunners || randInt(6,10);
    const runners = [];
    for (let i=0;i<runnersCount;i++) runners.push(genHorse(i));

    // Compute base performance scores (higher is better)
    const baseScores = runners.map(r => {
      const base = r.speed*0.42 + r.stamina*0.26 + r.jumpSkill*0.18 + r.consistency*0.14 + r.formBias;
      const noise = (rand()-0.5)*12; // small random noise
      return Math.max(1, base + noise);
    });

    // Rank horses by base score (0 = best)
    const indices = baseScores.map((s,i) => ({ s, i })).sort((a,b) => b.s - a.s).map(x => x.i);
    const rankOf = new Array(runnersCount);
    indices.forEach((idx, rank) => { rankOf[idx] = rank; });

    // Decide which horses receive an "underdog boost"
    // Boost probability increases with rank (underdogs more likely)
    const boosted = new Array(runnersCount).fill(false);
    let boostsAssigned = 0;
    for (let i=0;i<runnersCount;i++) {
      if (boostsAssigned >= MAX_BOOSTED_PER_RACE) break;
      // normalized rank factor: 0 for best, 1 for worst
      const normRank = rankOf[i] / Math.max(1, runnersCount - 1);
      // per-horse boost probability
      const p = UNDERDOG_BASE_BOOST_RATE * (1 + normRank * (UNDERDOG_BOOST_MULTIPLIER - 1));
      if (Math.random() < p) {
        boosted[i] = true;
        boostsAssigned++;
      }
    }

    // Apply boosts (if any) and compute final scores
    const finalScores = baseScores.map((s, i) => {
      let boost = 0;
      if (boosted[i]) {
        boost = UNDERDOG_BOOST_MIN + Math.random() * (UNDERDOG_BOOST_MAX - UNDERDOG_BOOST_MIN);
      }
      // Also add a small extra random jitter so results aren't deterministic
      const jitter = (rand()-0.5) * 6;
      return Math.max(0.1, s + boost + jitter);
    });

    // Convert final scores to probabilities (softmax-like)
    const total = finalScores.reduce((a,b) => a + b, 0);
    const probs = finalScores.map(s => s / total);

    // Slight margin to avoid impossibly low odds
    const margin = 1.06;
    const odds = probs.map(p => Math.max(1.01, (1/(p*margin))));

    // Attach computed values back to runners
    runners.forEach((r, i) => {
      r.baseScore = Math.round(baseScores[i]*100)/100;
      r.finalScore = Math.round(finalScores[i]*100)/100;
      r.boosted = !!boosted[i];
      r.odds = Math.round(odds[i]*100)/100;
      r.fracOdds = decimalToCommonFraction(r.odds);
      r.position = null;
    });

    const type = Math.random() < 0.4 ? 'Jump' : 'Flat';
    const fences = (type === 'Jump') ? Math.max(4, Math.round(runnersCount * 0.8)) : 0;

    return { id: uid('race'), runners, distance: (type === 'Jump' ? '2m 4f' : '1m 2f'), type, weather: 'Windy', temp: 17, fences, placeTerms: DEFAULT_PLACE_TERMS, result: null };
  }

  // -----------------------
  // rest of app unchanged
  // -----------------------
  function placeTermsForField(terms, fieldSize){
    for (const t of terms) if (fieldSize >= t.min && fieldSize <= t.max) return { places: t.places, frac: t.frac };
    return { places: 0, frac: 0 };
  }

  function computeCostAndEstimate(stake, type, runnerOdds, race){
    stake = Number(stake) || 0;
    const fieldSize = race.runners.length;
    const terms = placeTermsForField(race.placeTerms, fieldSize);
    if (type === 'win') {
      const cost = stake;
      const winReturn = stake * runnerOdds;
      return { cost, winReturn, placeReturn: 0 };
    } else if (type === 'eachway') {
      const cost = stake * 2;
      const winReturn = stake * runnerOdds;
      const placeReturn = stake * (1 + runnerOdds * terms.frac);
      return { cost, winReturn, placeReturn };
    }
    return { cost: 0, winReturn: 0, placeReturn: 0 };
  }

  function applyTheme(meeting) {
    const root = document.documentElement;
    root.style.setProperty('--primary', meeting.theme.primary);
    document.querySelectorAll('.player-card .player-bank').forEach(el => el.style.color = meeting.color);
    if (overlayCard) overlayCard.style.color = meeting.theme.primary;
    const betSlip = document.querySelector('.bet-slip');
    if (betSlip) betSlip.style.borderTop = `4px solid ${meeting.color}`;
    renderPlayers();
    renderBetsBox();
  }

  function shadeColor(hex, percent) {
    const num = parseInt(hex.replace('#',''),16);
    const r = Math.max(0, Math.min(255, (num >> 16) + percent));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + percent));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + percent));
    return `rgb(${r},${g},${b})`;
  }

  function renderPlayers() {
    playersList.innerHTML = '';
    state.players.forEach(p => {
      const div = document.createElement('div');
      div.className = 'player-card' + (p.id === state.ui.activePlayer ? ' active' : '');
      div.dataset.id = p.id;
      div.innerHTML = `<div class="player-info">
          <div class="player-name" data-id="${p.id}">${p.name}</div>
          <div class="player-bank" style="color:${getMeeting().color}">${formatMoney(p.bankroll)}</div>
        </div>
        <div>
          <button class="btn small ghost" data-action="rename" data-id="${p.id}">Rename</button>
        </div>`;
      playersList.appendChild(div);
    });
    activePlayerName.textContent = getActivePlayer().name;
    renderBetsBox();
  }

  playersList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'rename') {
        const p = state.players.find(x => x.id === id);
        const newName = prompt('Rename player', p.name);
        if (newName) { p.name = newName; saveState(state); renderPlayers(); }
      }
      return;
    }
    const card = e.target.closest('.player-card');
    if (card) {
      const id = card.dataset.id;
      setActivePlayer(id);
    }
  });

  function renderRaceUI(race) {
    if (meetingTitle) meetingTitle.textContent = `${getMeeting().name} • ${race.type}`;
    if (raceInfo) raceInfo.textContent = `${race.distance} • ${race.fences} fences • ${race.weather} • ${race.temp}°C`;
    if (raceMeta) raceMeta.textContent = `Runners: ${race.runners.length}`;
    racecardList.innerHTML = '';
    race.runners.forEach((r, idx) => {
      const card = document.createElement('div');
      card.className = 'runner-card';
      card.dataset.runnerId = r.id;
      const placeHtml = r.position ? `<span class="place-badge place-${r.position}">${r.position === 1 ? '1st' : r.position === 2 ? '2nd' : '3rd'}</span>` : '';
      card.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
          <span class="runner-swatch" style="background:${r.color}"></span>
          <div>
            <div style="font-weight:700">${idx+1}. ${r.name} ${placeHtml}</div>
            <div class="meta">${r.trainer} • Age ${r.age}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">${r.fracOdds}</div>
          <div class="meta">spd ${r.speed} • stm ${r.stamina}</div>
        </div>`;
      racecardList.appendChild(card);
    });

    if (betHorse) {
      betHorse.innerHTML = race.runners.map((r,i) => `<option value="${r.id}">${i+1}. ${r.name} (${r.fracOdds})</option>`).join('');
    }
    updateBetUI();
  }

  function updateBetUI() {
    const player = getActivePlayer();
    if (activePlayerName) activePlayerName.textContent = player.name;
    const race = currentRace;
    if (!race) { if (betCost) betCost.textContent='Cost: £0'; if (betEstimate) betEstimate.textContent='Estimate: £0'; return; }
    const selectedId = betHorse && betHorse.value ? betHorse.value : race.runners[0].id;
    const runner = race.runners.find(r=>r.id===selectedId);
    const stake = Number(betStake.value) || MIN_BET;
    const type = betType.value;
    const calc = computeCostAndEstimate(stake, type, runner.odds, race);
    if (betCost) betCost.textContent = `Cost: ${formatMoney(calc.cost)}`;
    if (betEstimate) {
      if (type === 'win') betEstimate.textContent = `If win: ${formatMoney(calc.winReturn)}`;
      else betEstimate.textContent = `If win: ${formatMoney(calc.winReturn)} • If place: ${formatMoney(calc.placeReturn)}`;
    }
  }

  function renderBetsBox() {
    betsBox.innerHTML = '';
    const meetingColor = getMeeting().color;
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';
    header.innerHTML = `<div style="font-weight:800">Placed Bets</div><div style="font-size:12px;color:${meetingColor}">Theme: ${getMeeting().name}</div>`;
    betsBox.appendChild(header);

    let any = false;
    state.players.forEach(p => {
      if (!p.bets || p.bets.length === 0) return;
      any = true;
      const playerHeader = document.createElement('div');
      playerHeader.className = 'bets-player-header';
      playerHeader.style.marginTop = '6px';
      playerHeader.innerHTML = `<div style="font-weight:700;margin-top:6px;color:${meetingColor}">${p.name}</div>`;
      betsBox.appendChild(playerHeader);
      p.bets.forEach(b => {
        const race = currentRace && currentRace.id === b.raceId ? currentRace : null;
        const runner = (race && race.runners) ? race.runners.find(r => r.id === b.runnerId) : null;
        const label = runner ? `${runner.name} (${b.type})` : `${b.runnerId} (${b.type})`;
        const est = (b.type === 'win') ? formatMoney(b.stakePerPart * b.odds) : `${formatMoney(b.stakePerPart * b.odds)} / ${formatMoney(b.stakePerPart * (1 + b.odds * placeTermsForField((race||currentRace).placeTerms, (race||currentRace).runners.length).frac))}`;
        const item = document.createElement('div');
        item.className = 'bet-item';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px';
        item.style.borderRadius = '999px';
        item.style.marginTop = '6px';
        item.style.background = `linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6))`;
        item.style.border = `none`;
        item.innerHTML = `<div>
            <div style="font-weight:700">${label}</div>
            <div class="meta" style="color:#6b7280">Stake: ${formatMoney(b.totalStake)} • Est: ${est}</div>
          </div>
          <div class="actions">
            <button class="btn small ghost" data-action="delete-bet" data-player="${p.id}" data-bet="${b.id}">Delete</button>
          </div>`;
        betsBox.appendChild(item);
      });
    });

    if (!any) {
      const empty = document.createElement('div');
      empty.style.color = '#6b7280';
      empty.style.marginTop = '8px';
      empty.textContent = 'No bets placed yet.';
      betsBox.appendChild(empty);
    }
  }

  betsBox.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'delete-bet') {
      const playerId = btn.dataset.player;
      const betId = btn.dataset.bet;
      deleteBet(playerId, betId);
    }
  });

  function deleteBet(playerId, betId) {
    const p = state.players.find(x => x.id === playerId);
    if (!p) return;
    const idx = p.bets.findIndex(b => b.id === betId);
    if (idx === -1) return;
    const bet = p.bets[idx];
    p.bankroll += bet.totalStake;
    p.bets.splice(idx,1);
    saveState(state);
    renderPlayers();
    renderBetsBox();
  }

  addPlayerBtn.addEventListener('click', () => {
    if (state.players.length >= 6) return alert('Max 6 players');
    const id = uid('p');
    const name = `Player ${state.players.length + 1}`;
    state.players.push({ id, name, bankroll: START_BANKROLL, bets: [] });
    setActivePlayer(id);
    saveState(state);
  });

  resetPlayersBtn.addEventListener('click', () => {
    if (!confirm('Reset players and bankrolls?')) return;
    state.players = [{ id: 'p1', name: 'Player 1', bankroll: START_BANKROLL, bets: [] }];
    state.ui.activePlayer = state.players[0].id;
    saveState(state);
    renderPlayers();
  });

  stakeMinus.addEventListener('click', () => { betStake.value = Math.max(MIN_BET, Number(betStake.value) - 5); updateBetUI(); });
  stakePlus.addEventListener('click', () => { betStake.value = Math.max(MIN_BET, Number(betStake.value) + 5); updateBetUI(); });
  betStake.addEventListener('input', updateBetUI);
  betType.addEventListener('change', updateBetUI);
  if (betHorse) betHorse.addEventListener('change', updateBetUI);

  placeBetBtn.addEventListener('click', () => {
    const player = getActivePlayer();
    const race = currentRace;
    if (!race) return alert('No race loaded');
    const stake = Number(betStake.value) || MIN_BET;
    if (stake < MIN_BET) return alert(`Minimum bet is £${MIN_BET}`);
    const type = betType.value;
    const runnerId = betHorse && betHorse.value ? betHorse.value : race.runners[0].id;
    const runner = race.runners.find(r => r.id === runnerId);
    const calc = computeCostAndEstimate(stake, type, runner.odds, race);
    if (player.bankroll < calc.cost) return alert('Insufficient funds');
    player.bankroll -= calc.cost;
    const bet = {
      id: uid('bet'),
      raceId: race.id,
      meetingId: state.meetingId,
      runnerId,
      type,
      stakePerPart: stake,
      totalStake: calc.cost,
      odds: runner.odds,
      settled: false
    };
    player.bets.push(bet);
    saveState(state);
    renderPlayers();
    renderBetsBox();
    updateBetUI();
  });

  nextPlayerBtn.addEventListener('click', () => {
    const idx = state.players.findIndex(p => p.id === state.ui.activePlayer);
    const next = state.players[(idx + 1) % state.players.length];
    setActivePlayer(next.id);
  });

  function updateCanvasForScale(scale, runnersCount) {
    const ratio = window.devicePixelRatio || 1;
    const baseW = Math.max(900, Math.min(1400, window.innerWidth - 760));
    const laneHeight = Math.max(36, Math.round(48 * scale));
    const topBottom = 80;
    const h = Math.max(320, topBottom + laneHeight * Math.max(8, runnersCount));
    const w = baseW;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function resetCanvas(){ ctx.clearRect(0,0,canvas.width,canvas.height); }

  function drawTrackVisuals(){
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const scale = animState && animState.scale ? animState.scale : 1;

    ctx.fillStyle = '#2aa84a';
    ctx.fillRect(0,0,w,h);

    const trackX = 40 * scale;
    const trackY = 30 * scale;
    const trackW = w - 80 * scale;
    const trackH = h - 60 * scale;
    ctx.fillStyle = '#1f7a2b';
    ctx.fillRect(trackX, trackY, trackW, trackH);

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(trackX, trackY - 8*scale, trackW, 6*scale);
    ctx.fillRect(trackX, trackY + trackH + 2*scale, trackW, 6*scale);

    ctx.fillStyle = '#fff';
    ctx.fillRect(w - 180*scale, trackY, 6*scale, trackH);

    const fenceCount = currentRace.fences || 0;
    for (let f=0; f<fenceCount; f++){
      const fx = trackX + Math.floor((trackW - 140*scale) * (f+1) / (fenceCount+1));
      const hedgeW = 18 * scale;
      const hedgeH = trackH;
      const hedgeY = trackY;
      ctx.fillStyle = '#0f5a2a';
      ctx.fillRect(fx - hedgeW/2, hedgeY, hedgeW, hedgeH);
      ctx.fillStyle = '#0b4a22';
      ctx.fillRect(fx - hedgeW/2, hedgeY + hedgeH/2 - 2*scale, hedgeW, 4*scale);
      ctx.fillStyle = '#6b3f1f';
      ctx.fillRect(fx - hedgeW/2 - 4*scale, hedgeY + hedgeH - 2*scale, 4*scale, 8*scale);
      ctx.fillRect(fx + hedgeW/2, hedgeY + hedgeH - 2*scale, 4*scale, 8*scale);
    }

    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#000';
    for (let i=0;i<60;i++) ctx.fillRect(trackX + i*18*scale, trackY + (i%2)*2*scale, 6*scale, trackH);
    ctx.globalAlpha = 1;
  }

  // animation & replay
  let currentRace = genRace();
  let animState = null;
  let animationId = null;
  let speedMultiplier = 0.5;
  let lastRaceRecording = null;
  let recordingEnabled = false;

  function initAnim(race){
    race.runners.forEach(r => { r.position = null; r.fallen = false; });
    const runners = race.runners.length;
    const scale = runners > 8 ? Math.max(0.5, 8 / runners) : 1;
    animState = {
      t: 0,
      finished: false,
      scale,
      nextPlace: 1,
      horses: race.runners.map((r, idx) => ({
        id: r.id, name: r.name, trainer: r.trainer, x: 0, lane: idx, laneOffset: 0,
        baseSpeed: ((r.speed / 12) + (rand()-0.5)*0.4) * scale,
        speedVar: 1, stamina: r.stamina, jumpSkill: r.jumpSkill, odds: r.odds, fracOdds: r.fracOdds,
        color: r.color, active: true, fallen: false, lastSurge: -100,
        jumping: false, jumpProgress: 0, jumpStartX: null, position: null
      })),
      finishOrder: []
    };

    lastRaceRecording = { frames: [], meta: { raceId: race.id, runners: race.runners.map(r => ({ id: r.id })) } };
    recordingEnabled = true;

    updateCanvasForScale(animState.scale, race.runners.length);
  }

  function recordFrame() {
    if (!recordingEnabled || !animState) return;
    const frame = animState.horses.map(h => ({ id: h.id, x: h.x, fallen: !!h.fallen, jumping: !!h.jumping }));
    lastRaceRecording.frames.push(frame);
  }

  function playRecording(recording) {
    if (!recording || !recording.frames || !recording.frames.length) {
      alert('No replay available.');
      return;
    }
    const runnersCount = recording.meta.runners.length;
    const scale = runnersCount > 8 ? Math.max(0.5, 8 / runnersCount) : 1;
    const horses = recording.meta.runners.map((r, idx) => {
      const runner = currentRace.runners.find(rr => rr.id === r.id) || { name: 'Horse', color: generateClothColor(idx), odds: 2.0 };
      return {
        id: r.id,
        name: runner.name,
        trainer: runner.trainer || '',
        x: 0,
        lane: idx,
        laneOffset: 0,
        baseSpeed: 0,
        speedVar: 1,
        stamina: runner.stamina || 60,
        jumpSkill: runner.jumpSkill || 70,
        odds: runner.odds || 2.0,
        fracOdds: runner.fracOdds || decimalToCommonFraction(runner.odds || 2.0),
        color: runner.color || generateClothColor(idx),
        active: true,
        fallen: false,
        jumping: false,
        position: null
      };
    });

    let frameIndex = 0;
    const totalFrames = recording.frames.length;
    function replayStep() {
      resetCanvas(); drawTrackVisuals();
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const scale = Math.max(0.5, 8 / Math.max(8, runnersCount));
      const laneH = Math.floor((h - 80*scale) / runnersCount);
      const raceLen = w - 260 * scale;

      const frame = recording.frames[Math.min(frameIndex, totalFrames-1)];
      horses.forEach((hse, idx) => {
        const f = frame.find(x => x.id === hse.id);
        if (f) {
          hse.x = f.x;
          hse.fallen = f.fallen;
          hse.jumping = f.jumping;
        }
        const baseY = 40*scale + idx * laneH + laneH/2;
        const y = baseY + hse.laneOffset * scale;
        const hx = 120*scale + Math.floor(hse.x);

        ctx.save();
        const bob = Math.sin((frameIndex + idx*10) * 0.18) * 3 * scale;
        let jumpYOffset = 0;
        if (hse.jumping) {
          const height = 18 * scale;
          jumpYOffset = -Math.sin(Math.PI * 0.5) * height;
        }
        ctx.translate(hx, y + bob + jumpYOffset);
        if (hse.fallen) { ctx.filter = 'grayscale(100%)'; ctx.globalAlpha = 0.6; } else { ctx.filter = 'none'; ctx.globalAlpha = 1; }
        const bodyW = 22 * scale;
        const bodyH = 12 * scale;
        ctx.fillStyle = hse.fallen ? '#666' : '#2b2b2b';
        ctx.beginPath(); ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2 * Math.max(0.6, scale);
        ctx.beginPath(); ctx.moveTo(-8*scale, 10*scale); ctx.lineTo(-12*scale, 18*scale); ctx.moveTo(8*scale, 10*scale); ctx.lineTo(12*scale, 18*scale); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.fillRect(18*scale, -6*scale, 10*scale, 6*scale);
        ctx.fillStyle = hse.color || '#444';
        ctx.fillRect(-6*scale, -10*scale, 12*scale, 8*scale);
        ctx.fillStyle = '#fff'; ctx.font = `${11 * Math.max(0.8, scale)}px sans-serif`;
        ctx.fillText((idx+1)+'. '+(hse.name.split(' ')[1] || hse.name), -30*scale, -18*scale);
        ctx.restore();
      });

      frameIndex++;
      if (frameIndex < totalFrames) {
        requestAnimationFrame(replayStep);
      }
    }

    replayStep();
  }

  function assignPlaceForHorse(horseId) {
    if (!animState) return;
    const horse = animState.horses.find(h => h.id === horseId);
    if (!horse || horse.fallen || horse.position) return;
    if (animState.nextPlace > 3) return;
    horse.position = animState.nextPlace;
    animState.nextPlace++;
    updateRunnerCard(horse.id, { position: horse.position });
    const runnerObj = currentRace.runners.find(r => r.id === horse.id);
    if (runnerObj) runnerObj.position = horse.position;
  }

  function updateRunnerCard(runnerId, { position = null, fallen = null } = {}) {
    const card = racecardList.querySelector(`[data-runner-id="${runnerId}"]`);
    if (!card) return;
    const runner = currentRace.runners.find(r => r.id === runnerId);
    if (!runner) return;
    if (position !== null) runner.position = position;
    if (fallen !== null) runner.fallen = fallen;
    const idx = currentRace.runners.findIndex(r => r.id === runnerId);
    const placeHtml = runner.position ? `<span class="place-badge place-${runner.position}">${runner.position === 1 ? '1st' : runner.position === 2 ? '2nd' : '3rd'}</span>` : '';
    card.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
          <span class="runner-swatch" style="background:${runner.color}"></span>
          <div>
            <div style="font-weight:700">${idx+1}. ${runner.name} ${placeHtml}</div>
            <div class="meta">${runner.trainer} • Age ${runner.age}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">${runner.fracOdds}</div>
          <div class="meta">spd ${runner.speed} • stm ${runner.stamina}</div>
        </div>`;
  }

  function stepAnim(){
    if (!animState) return;
    animState.t++;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const raceLen = w - 260 * animState.scale;
    const dt = 1 * speedMultiplier;

    animState.horses.forEach((hse) => {
      if (!hse.active) return;

      hse.stamina -= 0.015 * dt;
      hse.stamina = Math.max(6, hse.stamina);
      const fatigueFactor = Math.max(0.4, hse.stamina / 100);

      if (Math.random() < 0.004 * dt) hse.speedVar = 0.85 + Math.random() * 0.3;
      hse.speedVar += (1 - hse.speedVar) * 0.02 * dt;

      const progress = hse.x / raceLen;
      const fenceCount = currentRace.fences || 0;
      const nextFenceIndex = fenceCount > 0 ? Math.floor(progress * fenceCount) : -1;
      const fencePos = fenceCount > 0 ? (nextFenceIndex + 1) / (fenceCount + 1) : -1;
      const nearFence = fenceCount > 0 ? Math.abs(progress - fencePos) < 0.05 : false;

      if (currentRace.type === 'Jump') {
        if (!hse.jumping && nearFence && Math.random() < 0.02 * dt) {
          hse.jumping = true;
          hse.jumpProgress = 0;
          hse.jumpStartX = hse.x;
        }
      }

      let jumpPenalty = 0;
      if (hse.jumping) {
        hse.jumpProgress += 0.03 * dt * (1 + (1 - (hse.jumpSkill/100)));
        jumpPenalty = 0.85;
        if (Math.random() < (0.004 * dt) * (1 - hse.jumpSkill/140)) {
          if (Math.random() < 0.18) {
            hse.fallen = true; hse.active = false; animState.finishOrder.push({ id: hse.id, reason: 'fell' });
            hse.jumping = false;
            updateRunnerCard(hse.id, { fallen: true });
            return;
          } else {
            hse.x -= 8 * dt;
          }
        }
        if (hse.jumpProgress >= 1) { hse.jumping = false; hse.jumpProgress = 0; }
      } else {
        if (nearFence) jumpPenalty = 0.18;
      }

      if (progress > 0.7 && (animState.t - hse.lastSurge) > 60 && Math.random() < 0.04 * dt) {
        hse.lastSurge = animState.t; hse.speedVar *= 1.18 + Math.random()*0.18;
      }
      if (progress > 0.5 && Math.random() < 0.008 * dt && Math.random() < 0.2) hse.speedVar *= 0.88;

      const move = (hse.baseSpeed * hse.speedVar * fatigueFactor * (1 - jumpPenalty)) * dt;
      hse.x += move;

      const others = animState.horses.filter(o => o.id !== hse.id && o.active);
      others.forEach(o => {
        const dx = o.x - hse.x;
        if (dx > 6 && dx < 40 && o.baseSpeed * o.speedVar > hse.baseSpeed * hse.speedVar + 0.2) {
          o.laneOffset = Math.max(-12, o.laneOffset - 0.6 * dt);
          hse.laneOffset = Math.min(12, hse.laneOffset + 0.3 * dt);
        }
      });
      hse.laneOffset *= 0.98;

      if (hse.x >= raceLen && hse.active) {
        hse.x = raceLen + (Math.random()*6);
        hse.active = false;
        animState.finishOrder.push({ id: hse.id, x: hse.x });
        if (!hse.fallen) assignPlaceForHorse(hse.id);
      }
    });

    recordFrame();

    const activeCount = animState.horses.filter(h => h.active).length;
    if (activeCount === 0 || animState.t > 4000 / Math.max(0.5, speedMultiplier)) {
      animState.finished = true;
      finalizeRace();
      cancelAnimationFrame(animationId); animationId = null;
      recordingEnabled = false;
    }
  }

  function renderAnim(){
    resetCanvas(); drawTrackVisuals();
    if (!animState) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const scale = animState.scale || 1;
    const lanes = animState.horses.length;
    const laneH = Math.floor((h - 80*scale) / lanes);
    const raceLen = w - 260 * scale;

    animState.horses.forEach((hse, idx) => {
      const baseY = 40*scale + idx * laneH + laneH/2;
      const y = baseY + hse.laneOffset * scale;
      const hx = 120*scale + Math.floor(hse.x);

      ctx.save();
      const bob = Math.sin((animState.t + idx*10) * 0.18 * (1 + (hse.baseSpeed/10))) * 3 * scale;

      let jumpYOffset = 0;
      if (hse.jumping) {
        const height = 18 * scale * (1 + (1 - hse.jumpSkill/100));
        jumpYOffset = -Math.sin(Math.PI * Math.min(1, hse.jumpProgress)) * height;
      }

      ctx.translate(hx, y + bob + jumpYOffset);

      if (hse.fallen) { ctx.filter = 'grayscale(100%)'; ctx.globalAlpha = 0.6; } else { ctx.filter = 'none'; ctx.globalAlpha = 1; }

      const bodyW = 22 * scale;
      const bodyH = 12 * scale;
      ctx.beginPath(); ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI*2);
      ctx.fillStyle = hse.fallen ? '#666' : '#2b2b2b';
      ctx.fill();

      ctx.strokeStyle = '#111'; ctx.lineWidth = 2 * Math.max(0.6, scale);
      ctx.beginPath(); ctx.moveTo(-8*scale, 10*scale); ctx.lineTo(-12*scale, 18*scale); ctx.moveTo(8*scale, 10*scale); ctx.lineTo(12*scale, 18*scale); ctx.stroke();

      ctx.fillStyle = '#111'; ctx.fillRect(18*scale, -6*scale, 10*scale, 6*scale);

      ctx.fillStyle = hse.color || '#444';
      ctx.fillRect(-6*scale, -10*scale, 12*scale, 8*scale);

      ctx.fillStyle = '#fff'; ctx.font = `${11 * Math.max(0.8, scale)}px sans-serif`;
      ctx.fillText((idx+1)+'. '+(hse.name.split(' ')[1] || hse.name), -30*scale, -18*scale);

      if (hse.position && hse.position <= 3) {
        const badgeText = hse.position === 1 ? '1st' : hse.position === 2 ? '2nd' : '3rd';
        ctx.save();
        ctx.translate(hx + 28*scale, y - 6*scale);
        ctx.fillStyle = hse.position === 1 ? '#ffd700' : hse.position === 2 ? '#c0c0c0' : '#cd7f32';
        const bw = 36 * scale, bh = 18 * scale, br = 10 * scale;
        roundRect(ctx, -bw/2, -bh/2, bw, bh, br);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.font = `${10 * Math.max(0.8, scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, 0, 0);
        ctx.restore();
      }

      ctx.restore();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function animLoop(){ stepAnim(); renderAnim(); if (!animState.finished) animationId = requestAnimationFrame(animLoop); }

  function startRace(){ 
    if (!currentRace) return; 
    currentRace.runners.forEach(r => { r.position = null; r.fallen = false; });
    initAnim(currentRace); 
    if (animationId) cancelAnimationFrame(animationId); 
    animationId = requestAnimationFrame(animLoop); 
  }

  function finalizeRace(){
    if (!animState) return;
    const finished = animState.horses.slice().sort((a,b) => b.x - a.x);
    finished.forEach((h) => {
      if (!h.fallen && !h.position && animState.nextPlace <= 3) {
        h.position = animState.nextPlace;
        animState.nextPlace++;
        updateRunnerCard(h.id, { position: h.position });
      }
    });

    currentRace.result = finished.map(h => ({ id: h.id, name: h.name, fallen: !!h.fallen, position: h.position || null, x: h.x }));
    currentRace.runners.forEach(r => {
      const found = currentRace.result.find(h => h.id === r.id);
      if (found) {
        r.position = found.position || null;
        r.fallen = found.fallen || false;
      } else {
        r.position = null;
        r.fallen = false;
      }
    });

    renderRaceUI(currentRace);

    recordingEnabled = false;

    const messages = settleBetsForRace(currentRace);
    showSettlementModal(messages);
    saveState(state);

    incrementMeetingRaceCountAndMaybeRotate();
  }

  function settleBetsForRace(race){
    if (!race || !race.result) return [];
    const finishOrder = race.result.filter(r => !r.fallen).sort((a,b) => {
      const pa = a.position || 999, pb = b.position || 999;
      if (pa !== pb) return pa - pb;
      return (b.x || 0) - (a.x || 0);
    }).map(r => r.id);

    const terms = placeTermsForField(race.placeTerms, race.runners.length);
    const messages = [];

    state.players.forEach(p => {
      let playerTotalWin = 0;
      p.bets.forEach(b => {
        if (b.settled || b.raceId !== race.id) return;
        const posIndex = finishOrder.indexOf(b.runnerId);

        if (b.type === 'win') {
          if (posIndex === 0) {
            const ret = b.stakePerPart * b.odds;
            p.bankroll += ret;
            playerTotalWin += ret;
          }
        } else if (b.type === 'eachway') {
          if (posIndex === 0) {
            const winRet = b.stakePerPart * b.odds;
            const placeRet = b.stakePerPart * (1 + b.odds * terms.frac);
            p.bankroll += (winRet + placeRet);
            playerTotalWin += (winRet + placeRet);
          } else if (posIndex > 0 && posIndex <= terms.places) {
            const placeRet = b.stakePerPart * (1 + b.odds * terms.frac);
            p.bankroll += placeRet;
            playerTotalWin += placeRet;
          }
        }

        b.settled = true;
      });

      if (playerTotalWin > 0) messages.push({ player: p.name, amount: playerTotalWin });
    });

    saveState(state);
    renderPlayers();
    return messages;
  }

  function showSettlementModal(messages){
    settlementList.innerHTML = '';
    if (!messages || messages.length === 0) {
      const row = document.createElement('div'); row.className='modal-row'; row.textContent='No winning bets this race.'; settlementList.appendChild(row);
    } else {
      messages.forEach(m => {
        const row = document.createElement('div'); row.className='modal-row';
        row.innerHTML = `<div style="font-weight:700">${m.player}</div><div style="font-weight:700">${formatMoney(m.amount)}</div>`;
        settlementList.appendChild(row);
      });
    }
    settlementModal.classList.remove('hidden'); settlementModal.setAttribute('aria-hidden','false'); settlementOk.focus();
  }

  function hideSettlementModal(){ settlementModal.classList.add('hidden'); settlementModal.setAttribute('aria-hidden','true'); }

  settlementOk.addEventListener('click', hideSettlementModal);
  settlementModal.addEventListener('click', (e) => { if (e.target === settlementModal) hideSettlementModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && settlementModal && !settlementModal.classList.contains('hidden')) hideSettlementModal(); });

  function incrementMeetingRaceCountAndMaybeRotate() {
    const mid = state.meetingId;
    meetingCounts[mid] = (meetingCounts[mid] || 0) + 1;
    saveMeetingCounts(meetingCounts);

    if (meetingCounts[mid] >= RACES_PER_MEETING) {
      const reset = confirm(`${getMeeting().name} has completed ${RACES_PER_MEETING} races.\n\nPress OK to reset all players' bankrolls to £${START_BANKROLL} for the next meeting.\nPress Cancel to carry over current bankrolls.`);
      if (reset) {
        state.players.forEach(p => { p.bankroll = START_BANKROLL; p.bets = []; });
      }
      const current = state.meetingId;
      const others = MEETINGS.filter(m => m.id !== current);
      const pick = others[randInt(0, others.length - 1)];
      state.meetingId = pick.id;
      meetingCounts[pick.id] = 0;
      saveMeetingCounts(meetingCounts);
      saveState(state);
      applyTheme(pick);

      currentRace = genRace();
      currentRace.runners.forEach(r => { r.position = null; r.fallen = false; });
      renderRaceUI(currentRace);
      renderPlayers();
      renderBetsBox();

      if (overlayCard) {
        overlayCard.textContent = `Now racing at ${pick.name}`;
        overlayCard.style.color = pick.theme.primary;
        overlayCard.style.fontSize = '34px';
        overlayCard.style.fontWeight = '900';
      }
      if (meetingOverlay) {
        meetingOverlay.classList.remove('hidden');
        meetingOverlay.setAttribute('aria-hidden','false');
      }
      setTimeout(() => {
        if (meetingOverlay) {
          meetingOverlay.classList.add('hidden');
          meetingOverlay.setAttribute('aria-hidden','true');
        }
      }, 1600);
    } else {
      // no rotation yet
    }
  }

  nextRaceBtn.addEventListener('click', () => {
    state.players.forEach(p => { p.bets = []; });
    renderBetsBox();

    if (!state.rollover) {
      state.players.forEach(p => { p.bankroll = START_BANKROLL; p.bets = []; });
    }

    currentRace = genRace();
    currentRace.runners.forEach(r => { r.position = null; r.fallen = false; });
    renderRaceUI(currentRace);

    if (betStake) betStake.value = MIN_BET;
    if (betType) betType.value = 'win';
    if (betHorse) betHorse.selectedIndex = 0;
    updateBetUI();

    saveState(state);
  });

  newMeetingBtn.addEventListener('click', () => {
    const current = state.meetingId;
    const others = MEETINGS.filter(m => m.id !== current);
    const pick = others[randInt(0, others.length - 1)];
    state.meetingId = pick.id;
    saveState(state);
    applyTheme(pick);

    state.players.forEach(p => { p.bets = []; });
    renderBetsBox();

    currentRace = genRace();
    currentRace.runners.forEach(r => { r.position = null; r.fallen = false; });
    renderRaceUI(currentRace);
    renderPlayers();

    if (overlayCard) {
      overlayCard.textContent = `Now racing at ${pick.name}`;
      overlayCard.style.color = pick.theme.primary;
      overlayCard.style.fontSize = '34px';
      overlayCard.style.fontWeight = '900';
    }
    if (meetingOverlay) {
      meetingOverlay.classList.remove('hidden');
      meetingOverlay.setAttribute('aria-hidden','false');
    }
    setTimeout(() => {
      if (meetingOverlay) {
        meetingOverlay.classList.add('hidden');
        meetingOverlay.setAttribute('aria-hidden','true');
      }
    }, 1600);

    meetingCounts[pick.id] = meetingCounts[pick.id] || 0;
    saveMeetingCounts(meetingCounts);

    if (betStake) betStake.value = MIN_BET;
    if (betType) betType.value = 'win';
    if (betHorse) betHorse.selectedIndex = 0;
    updateBetUI();
  });

  function initUI(){
    applyTheme(getMeeting());
    renderPlayers();
    currentRace = genRace();
    renderRaceUI(currentRace);
    saveState(state);
    updateBetUI();
    renderBetsBox();
    updateCanvasForScale(1, currentRace.runners.length);
    initStakePills();

    meetingCounts[state.meetingId] = meetingCounts[state.meetingId] || 0;
    saveMeetingCounts(meetingCounts);

    (function enforceLayoutOrder(){
      const left = document.querySelector('.left-col');
      const center = document.querySelector('.center-col');
      const right = document.querySelector('.right-col');
      if (!left || !center || !right) return;
      const main = document.querySelector('.main-grid');
      if (main) {
        main.innerHTML = '';
        main.appendChild(left);
        main.appendChild(center);
        main.appendChild(right);
      }
    })();
  }

  function onWindowResize(){
    const scale = animState && animState.scale ? animState.scale : 1;
    const runners = currentRace && currentRace.runners ? currentRace.runners.length : 10;
    updateCanvasForScale(scale, runners);
  }
  window.addEventListener('resize', onWindowResize);

  if (startRaceBtn) {
    startRaceBtn.addEventListener('click', () => {
      if (speedMultiplier !== 2) speedMultiplier = 0.5;
      startRace();
    });
  }

  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      if (lastRaceRecording && lastRaceRecording.frames && lastRaceRecording.frames.length) {
        playRecording(lastRaceRecording);
      } else {
        alert('No replay available. Run a race first.');
      }
    });
  }

  function initStakePills() {
    const stakePillsContainer = document.getElementById('stakePills');
    if (!stakePillsContainer) return;

    const pills = Array.from(stakePillsContainer.querySelectorAll('.pill-stake'));
    function clearActive() { pills.forEach(p => p.classList.remove('active')); }

    pills.forEach(p => {
      p.addEventListener('click', (ev) => {
        const v = Number(p.dataset.value) || 5;
        if (betStake) betStake.value = v;
        clearActive();
        p.classList.add('active');
        updateBetUI();
      });
    });

    if (betStake) {
      betStake.addEventListener('input', () => {
        clearActive();
        updateBetUI();
      });
    }
  }

  initUI();
});
