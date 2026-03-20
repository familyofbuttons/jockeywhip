/* Jockey Whip Races — full app logic
   - Brand set to "Jockey Whip Races"
   - Stamina hidden from UI
   - Added Form stat (1–5)
   - Added Expert Mode toggle
   - Odds removed from animation visuals where requested
   - Bets, players, and UI behavior preserved
*/

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const GAME_TITLE = 'Jockey Whip Races';
  document.title = GAME_TITLE;

  // ICON helper
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
  const UNDERDOG_BASE_BOOST_RATE = 0.02;
  const UNDERDOG_BOOST_MULTIPLIER = 4.0;
  const UNDERDOG_BOOST_MIN = 6;
  const UNDERDOG_BOOST_MAX = 18;
  const MAX_BOOSTED_PER_RACE = 2;
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

  // ⭐ Added expertMode to default state
  const defaultState = {
    meetingId: MEETINGS[1].id,
    players: [],
    rollover: true,
    ui: { activePlayer: null },
    expertMode: false
  };

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

  // ⭐ NEW: Expert Mode toggle button
  const expertToggle = $('expertToggle');

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

  // ⭐ UPDATED: Added form, stamina still used internally but hidden from UI
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
    const form = randInt(1,5); // ⭐ NEW FORM STAT

    return {
      id: uid('h'),
      name,
      trainer,
      age,
      speed,
      stamina,
      jumpSkill,
      consistency,
      formBias,
      color,
      form,
      recent: [],
      position: null
    };
  }
