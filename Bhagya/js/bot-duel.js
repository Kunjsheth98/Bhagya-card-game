// BHAGYA — Bot Battle (single player vs AI)
// Same real hand-of-5, choose-your-card, block/steal/shield tactics as Duel of Fates —
// just against a computer opponent instead of a second person. No network needed.

const BOT_UID = "BOT";
const BOT_ROUND_OPTIONS = { 3: 2, 5: 3, 7: 4 }; // total rounds shown -> wins needed

let botState = null;
let botMyUid = null;
let botDifficulty = "medium";
let botTotalRounds = 5;
let botActing = false;
let botLoopTimeout = null;

function botDifficultyLabel(d) {
  return { easy: "Bot (Easy)", medium: "Bot (Medium)", hard: "Bot (Hard)" }[d];
}

// ---------------------------------------------------------------
// Setup screen
// ---------------------------------------------------------------
function openBotSetup() {
  showScreen("#screen-bot-setup");
  $all("#bot-difficulty-options .select-chip").forEach(el => el.classList.toggle("active", el.dataset.value === botDifficulty));
  $all("#bot-rounds-options .select-chip").forEach(el => el.classList.toggle("active", el.dataset.value === String(botTotalRounds)));
}

function startBotBattle() {
  resetBattleUiFlags();
  botMyUid = getPlayerUid();
  const winsNeeded = BOT_ROUND_OPTIONS[botTotalRounds];
  const initialState = {
    players: { [botMyUid]: { name: localStorage.getItem("bhagya_player_name") || "Player" } },
    order: [botMyUid, BOT_UID],
    phase: "lobby",
    round: 1,
    winsNeeded,
    roundWins: {},
    awayStrikes: {},
    deckOrder: shuffledDeck(),
    deckPointer: 0,
    matchLog: []
  };
  botState = beginBattleRound(initialState, 1, botMyUid); // player always starts round 1
  showScreen("#screen-duel");
  renderBotBoard();
}

// ---------------------------------------------------------------
// Rendering + play loop
// ---------------------------------------------------------------
function renderBotBoard() {
  renderBattleBoard(botState, botMyUid, BOT_UID, botDifficultyLabel(botDifficulty), botPlayCard, { showTimer: false });

  if (botState.phase === "round_end") {
    showBattleRoundEnd(botState, botMyUid, botDifficultyLabel(botDifficulty), botContinueAfterRound);
  }
  if (botState.phase === "match_end") {
    showBattleMatchEnd(botState, botMyUid, botDifficultyLabel(botDifficulty), () => {
      showScreen("#screen-main-menu"); renderMainMenu();
    });
  }

  if (botState.phase === "playing" && botState.turnUid === BOT_UID && !botActing) {
    botLoopTimeout = setTimeout(botTakeTurn, 900 + Math.random() * 700);
  }
}

function botPlayCard(index) {
  if (botActing) return;
  if (botState.turnUid !== botMyUid || botState.phase !== "playing") return;
  const entry = botState.hands[botMyUid][index];
  if (!entry || entry.played) return;

  botActing = true;
  botState.hands[botMyUid][index].played = true;
  resolveBattlePlay(botState, botMyUid, entry.cardId);
  advanceBattleTurn(botState);
  botActing = false;
  renderBotBoard();
}

function botTakeTurn() {
  if (!botState || botState.phase !== "playing" || botState.turnUid !== BOT_UID) return;
  botActing = true;
  const hand = botState.hands[BOT_UID];
  const unplayed = hand.map((c, i) => ({ ...c, i })).filter(c => !c.played);
  if (!unplayed.length) { botActing = false; return; }

  const chosen = botChooseCard(unplayed);
  hand[chosen.i].played = true;
  resolveBattlePlay(botState, BOT_UID, chosen.cardId);
  advanceBattleTurn(botState);
  botActing = false;
  renderBotBoard();
}

function botChooseCard(unplayed) {
  if (botDifficulty === "easy") {
    return unplayed[Math.floor(Math.random() * unplayed.length)];
  }

  const behind = botState.roundScores[BOT_UID] < botState.roundScores[botMyUid];
  const cardsLeft = unplayed.length;

  const scored = unplayed.map(entry => {
    const cd = cardById(entry.cardId);
    const t = cd.effectType.toLowerCase();
    let score = cd.basePoints;

    if (behind && (t.includes("steal") || t.includes("curse") || t.includes("double"))) score += 35;
    if (!behind && (t.includes("shield") || t.includes("lock") || t.includes("block"))) score += 25;
    if (!behind && t.includes("boost")) score += 12;
    if (t.includes("skip") && cardsLeft <= 2) score += 30;
    if (botDifficulty === "hard") {
      if (behind && (t.includes("steal") || t.includes("curse"))) score += 20; // extra aggression on hard
      if (!behind && t.includes("boost")) score += 10;
    }
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (botDifficulty === "medium") {
    const top = scored.slice(0, Math.min(2, scored.length));
    return top[Math.floor(Math.random() * top.length)].entry;
  }
  return scored[0].entry; // hard = always optimal by this heuristic
}

function botContinueAfterRound() {
  if (botState.phase === "match_end") return;
  clearTimeout(botLoopTimeout);
  const nextRound = botState.round + 1;
  const startingUid = nextRound % 2 === 1 ? botMyUid : BOT_UID; // alternate starting player
  botState = beginBattleRound(botState, nextRound, startingUid);
  renderBotBoard();
}

function quitBotBattle() {
  clearTimeout(botLoopTimeout);
  resetBattleUiFlags();
  $all(".overlay").forEach(ov => ov.remove());
  botState = null;
  showScreen("#screen-main-menu");
  renderMainMenu();
}

// ---------------------------------------------------------------
// Wire up
// ---------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  $("#mode-bot-battle").addEventListener("click", openBotSetup);
  $("#bot-setup-back").addEventListener("click", () => showScreen("#screen-single-player-menu"));

  $all("#bot-difficulty-options .select-chip").forEach(el => {
    el.addEventListener("click", () => { botDifficulty = el.dataset.value; openBotSetup(); });
  });
  $all("#bot-rounds-options .select-chip").forEach(el => {
    el.addEventListener("click", () => { botTotalRounds = parseInt(el.dataset.value); openBotSetup(); });
  });
  $("#bot-start-btn").addEventListener("click", startBotBattle);
  $("#duel-quit-btn").addEventListener("click", () => {
    // shared quit button on #screen-duel — routes based on which mode is active
    if (botState) quitBotBattle();
    else if (typeof duelExitToMenu === "function" && duelLatestState) duelExitToMenu();
    else { showScreen("#screen-main-menu"); renderMainMenu(); }
  });
});
