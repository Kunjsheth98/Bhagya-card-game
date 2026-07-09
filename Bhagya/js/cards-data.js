// BHAGYA — Card & Modifier Data
// Auto-generated to exactly match Bhagya_Card_Database.xlsx — do not hand-edit without updating both.

const RARITY_POINTS = { Common: 10, Uncommon: 25, Rare: 50, Mythic: 100, Legendary: 250 };

const RARITY_COLOR = {
  Common: "#b9b9c2",
  Uncommon: "#6fcf7f",
  Rare: "#5aa7f0",
  Mythic: "#c084fc",
  Legendary: "#f2c14e"
};

const SUIT_COLOR = {
  Prem: "#e05a8a",
  Dhan: "#e8862e",
  Shakti: "#d13b3b",
  Gyan: "#3f6fd1",
  Chaya: "#7b5ec9",
  Tara: "#c9a227"
};

const CARDS = [
["Prem","Common","Pehli Nazar","First Glance","Boost","Gives you bonus points. Gives even more if you already have another Prem card in hand.","01_pehli_nazar"],
["Prem","Common","Muskaan","Smile","Boost","Simple points boost. Always safe to play.","02_muskaan"],
["Prem","Common","Saath","Together","Shield","Protects you from the next Steal card played against you.","03_saath"],
["Prem","Common","Vaada","Promise","Lock","This card is locked for 2 turns — no one can steal or block it.","04_vaada"],
["Prem","Common","Yaadein","Memories","Peek","Lets you secretly look at one card in another player's hand.","05_yaadein"],
["Prem","Uncommon","Rishta","Bond","Swap","Trade one of your cards with any other player's card.","06_rishta"],
["Prem","Uncommon","Bharosa","Trust","Shield","Protects your whole hand from one Chaya (shadow) card this round.","07_bharosa"],
["Prem","Uncommon","Judaai","Separation","Risk","Costs you points now, but pays off big if you draw a Shakti card next.","08_judaai"],
["Prem","Uncommon","Milan","Union","Boost","Good points boost — doubles if paired with another Prem card in the same round.","09_milan"],
["Prem","Rare","Iqraar","Confession","Boost","Big points boost. In team modes, sharing your hand here builds trust bonuses.","10_iqraar"],
["Prem","Rare","Saccha Pyaar","True Love","Double","Doubles the points of any one other card in your hand.","11_saccha_pyaar"],
["Prem","Mythic","Ek Duje Ke Liye","Meant To Be","Boost","Huge points boost. Even bigger if played alongside a Dhan card.","12_ek_duje_ke_liye"],
["Prem","Legendary","Amar Prem","Eternal Love","Boost+Shield","Massive points boost and protects you from ALL shadow curses for the rest of the match.","13_amar_prem"],
["Dhan","Common","Sikka","Coin","Boost","Simple points boost.","14_sikka"],
["Dhan","Common","Bachat","Savings","Extra Draw","Draw one extra card immediately.","15_bachat"],
["Dhan","Common","Vyapar","Trade","Swap","Trade one card with any other player.","16_vyapar"],
["Dhan","Common","Kismat","Luck","Boost","Points boost with a small chance the game doubles it for you.","17_kismat"],
["Dhan","Common","Tijori","Treasure Chest","Peek","See the next 3 cards in the deck and choose 1 to keep.","18_tijori"],
["Dhan","Uncommon","Nidhi","Fortune","Boost","Solid points boost.","19_nidhi"],
["Dhan","Uncommon","Sona","Gold","Double","Doubles your ENTIRE score for this round.","20_sona"],
["Dhan","Uncommon","Vriddhi","Growth","Boost","Points boost that grows bigger the more cards you've already played this round.","21_vriddhi"],
["Dhan","Uncommon","Lagaan","Tax","Steal","Takes points away from whoever is currently winning.","22_lagaan"],
["Dhan","Rare","Khazana","Treasure","Extra Draw","Draw two extra cards immediately.","23_khazana"],
["Dhan","Rare","Samriddhi","Prosperity","Boost+Draw","Big points boost plus one extra card draw.","24_samriddhi"],
["Dhan","Mythic","Maha Lakshmi ka Ashirwad","Blessing of Wealth","Boost","Huge points boost — doubles every other Dhan card you play this round.","25_maha_lakshmi_ka_ashirwad"],
["Dhan","Legendary","Kuber ka Khazana","Treasure of the Wealth-God","Boost+Steal","Massive points boost, and takes a quarter of the leader's score for yourself.","26_kuber_ka_khazana"],
["Shakti","Common","Himmat","Courage","Boost","Simple points boost.","27_himmat"],
["Shakti","Common","Sankalp","Resolve","Block","Cancels one Steal or Curse card played against you.","28_sankalp"],
["Shakti","Common","Taakat","Power","Boost","Points boost — bigger if it's the last card you play this round.","29_taakat"],
["Shakti","Common","Dhairya","Patience","Shield","Blocks one attack-type card against you this turn.","30_dhairya"],
["Shakti","Common","Josh","Passion","Boost+Cure","Points boost and removes any curse currently on you.","31_josh"],
["Shakti","Uncommon","Veerta","Bravery","Skip","The next player after you loses their turn.","32_veerta"],
["Shakti","Uncommon","Adamya Shakti","Unstoppable Strength","Boost","Points boost that can never be blocked by anyone.","33_adamya_shakti"],
["Shakti","Uncommon","Raksha Kavach","Protective Shield","Shield","Protects your entire hand for the whole round.","34_raksha_kavach"],
["Shakti","Uncommon","Prahar","Strike","Steal","Takes points from any player of your choice.","35_prahar"],
["Shakti","Rare","Vijay","Victory","Boost","Big boost — doubles if it's the very last card played in the round.","36_vijay"],
["Shakti","Rare","Yudh Kaushal","Battle Skill","Block+Boost","Cancels one attack against you AND gives you bonus points.","37_yudh_kaushal"],
["Shakti","Mythic","Mahabali","Great Warrior","Boost+Immune","Huge points boost — makes you immune to all shadow (Chaya) cards for the rest of the match.","38_mahabali"],
["Shakti","Legendary","Hanuman ka Bal","Strength of Hanuman","Boost+Cleanse","Massive points boost and instantly removes every curse on you.","39_hanuman_ka_bal"],
["Gyan","Common","Jigyasa","Curiosity","Peek","Look at the next card in the deck before it's drawn.","40_jigyasa"],
["Gyan","Common","Samjh","Understanding","Boost","Simple points boost.","41_samjh"],
["Gyan","Common","Drishti","Insight","Reveal","See one opponent's whole hand for this round.","42_drishti"],
["Gyan","Common","Santulan","Balance","Safe Boost","A small, guaranteed boost that can never be blocked or stolen.","43_santulan"],
["Gyan","Common","Vichar","Thought","Boost+Guess","Points boost, plus a bonus if you correctly guess the next card drawn.","44_vichar"],
["Gyan","Uncommon","Bhavishyavani","Prediction","Guess","Guess the suit of the next card drawn — big bonus if you're right.","45_bhavishyavani"],
["Gyan","Uncommon","Ekagrata","Focus","Boost+Lock","Points boost that locks your score so it can't be stolen this round.","46_ekagrata"],
["Gyan","Uncommon","Gyan Ganga","River of Knowledge","Draw+Peek","Draw a card and peek at one more card in the deck.","47_gyan_ganga"],
["Gyan","Uncommon","Chaturai","Cleverness","Swap","Swap any two cards between any two players (great fun in group games).","48_chaturai"],
["Gyan","Rare","Vidwatta","Scholarship","Boost+Reveal","Points boost, and shows you the special power of the next 3 cards coming up.","49_vidwatta"],
["Gyan","Rare","Antar-Gyan","Inner Wisdom","Reveal","See the complete hand of any one player.","50_antar-gyan"],
["Gyan","Mythic","Trikaal Drishti","Vision of Time","Boost+Reveal","Huge points boost and reveals the next 5 cards in the deck, just for you.","51_trikaal_drishti"],
["Gyan","Legendary","Saraswati ka Ashirwad","Blessing of Saraswati","Boost+Passive","Massive points boost — every Gyan card you play for the rest of the match gets an automatic bonus.","52_saraswati_ka_ashirwad"],
["Chaya","Common","Bhram","Illusion","Trick","Looks like a big boost, but is secretly much smaller — the truth is revealed only when played.","53_bhram"],
["Chaya","Common","Parivartan","Change","Reshuffle","Your entire hand is shuffled away and redealt fresh.","54_parivartan"],
["Chaya","Common","Dhundh","Fog","Block","Blocks everyone's Peek and Reveal cards for this round.","55_dhundh"],
["Chaya","Common","Chhal","Trick","Steal","Takes a small number of points from a random player.","56_chhal"],
["Chaya","Common","Bechaini","Unease","Curse+Reward","Costs you points now, but guarantees your next card is Rare or better.","57_bechaini"],
["Chaya","Uncommon","Rahasya","Mystery","Random","Turns into a completely random effect from any other card in the deck.","58_rahasya"],
["Chaya","Uncommon","Bhagya Palat","Fate Reversal","Swap Score","Swaps your current round score with any other player's.","59_bhagya_palat"],
["Chaya","Uncommon","Andhera","Darkness","Disable","The next card an opponent plays has no effect.","60_andhera"],
["Chaya","Uncommon","Chakravyuh","Trap","Steal","Takes points from an opponent — but a Shakti card in their hand can block it.","61_chakravyuh"],
["Chaya","Rare","Mayajaal","Web of Illusion","Curse","Takes a large chunk of points away from whoever is currently winning.","62_mayajaal"],
["Chaya","Rare","Kalchakra","Wheel of Time","Undo","Cancels the very last card anyone played.","63_kalchakra"],
["Chaya","Mythic","Shani ki Drishti","Gaze of Shani","Curse+Boost","Takes points from the leader and gives them to you instead.","64_shani_ki_drishti"],
["Chaya","Legendary","Rahu-Ketu ka Prabhav","Influence of Rahu-Ketu","Chaos","Randomly shuffles ALL players' scores between each other — total chaos, biggest swing card in the shadow suit.","65_rahu-ketu_ka_prabhav"],
["Tara","Rare","Tara Kiran","Starbeam","Boost+Bless","Good points boost, and automatically blesses your next card played.","66_tara_kiran"],
["Tara","Rare","Chandra Prakash","Moonlight","Peek","Reveals the order of the remaining deck for the rest of the round.","67_chandra_prakash"],
["Tara","Rare","Surya Tej","Sun's Brilliance","Boost+Cleanse","Good points boost and removes all curses currently on you.","68_surya_tej"],
["Tara","Rare","Graha Yog","Planetary Alignment","Double All","Doubles the points of every card you've played so far this round.","69_graha_yog"],
["Tara","Rare","Nakshatra ka Ashirwad","Blessing of the Stars","Boost+Draw","Points boost plus a guaranteed Uncommon-or-better extra card.","70_nakshatra_ka_ashirwad"],
["Tara","Rare","Dhruv Tara","Pole Star","Lock","Locks your score for the rest of the match — can never be stolen or cursed.","71_dhruv_tara"],
["Tara","Mythic","Amrit Varsha","Rain of Nectar","Team Boost","Gives a big points boost to you AND every teammate (team modes only).","72_amrit_varsha"],
["Tara","Mythic","Kaal Chakra","Wheel of Fate","Reset","Your whole hand is redrawn, guaranteed Rare or better on every card.","73_kaal_chakra"],
["Tara","Mythic","Vishwakarma ka Vardaan","Boon of the Architect","Combo","Combines the effects of any two cards already played this round into one.","74_vishwakarma_ka_vardaan"],
["Tara","Mythic","Panchang ka Rahasya","Secret of the Almanac","Reveal All","Reveals every player's hand for the rest of the round.","75_panchang_ka_rahasya"],
["Tara","Mythic","Trilok Vijay","Victory Over Three Worlds","Boost+Steal","Very big points boost, and takes points from every other player at once.","76_trilok_vijay"],
["Tara","Legendary","Mahakal ka Ashirwad","Blessing of Mahakal","Full Reset","Your entire hand is redrawn, guaranteed Mythic or better on every card. The rarest reroll in the game.","77_mahakal_ka_ashirwad"],
["Tara","Legendary","Grahan","Eclipse","Total Chaos","Randomly swaps EVERY player's total score with each other. The single biggest swing card in Bhagya — use wisely.","78_grahan"]
].map(([suit, rarity, hindi, eng, effectType, desc, img], i) => ({
  id: i + 1,
  suit, rarity, hindi, eng, effectType, desc,
  basePoints: RARITY_POINTS[rarity],
  img: `assets/cards/${img}.webp`
}));

// 10 Modifiers — id, name, hindi, formula type, weight (higher = more common), multiplier/behaviour
const MODIFIERS = [
  { id: "none",      name: "—",              hindi: "",              weight: 40, mult: 1,   extraDraw: 0, note: "" },
  { id: "prabhat",   name: "Dawn",           hindi: "Prabhat",       weight: 14, mult: 1.1, extraDraw: 0, note: "A mild blessing of the morning light. +10% points." },
  { id: "sandhya",   name: "Dusk",           hindi: "Sandhya",       weight: 14, mult: 0.9, extraDraw: 1, note: "The fading light costs a little, but grants you an extra draw." },
  { id: "varsha",    name: "Monsoon",        hindi: "Varsha",        weight: 8,  mult: 1,   extraDraw: 0, note: "The effect's target becomes unpredictable." },
  { id: "vakri",     name: "Retrograde",     hindi: "Vakri",         weight: 6,  mult: -1,  extraDraw: 0, note: "The card's effect reverses entirely." },
  { id: "ashirwad",  name: "Blessed",        hindi: "Ashirwad",      weight: 6,  mult: 2,   extraDraw: 0, note: "A true blessing. Doubles the card's power." },
  { id: "shrapit",   name: "Cursed",         hindi: "Shrapit",       weight: 4,  mult: 3,   extraDraw: 0, cost: 10, note: "Immense power at a cost — triples points but costs 10." },
  { id: "yugal",     name: "Twin",           hindi: "Yugal",         weight: 3,  mult: 2,   extraDraw: 0, note: "The card's effect resolves twice." },
  { id: "pratibimb", name: "Echo",           hindi: "Pratibimb",     weight: 2,  mult: 1,   extraDraw: 0, note: "Echoes the last effect that was played." },
  { id: "puratan",   name: "Ancient",        hindi: "Puratan",       weight: 2,  mult: 1,   extraDraw: 0, note: "This becomes a permanent passive for the rest of the run." },
  { id: "amavasya",  name: "New Moon",       hindi: "Amavasya",      weight: 1,  mult: 2,   extraDraw: 0, note: "Total unpredictability — the effect is completely rewritten." }
];

// weighted pick helper used by the game engine
function pickWeighted(list, weightKey = "weight") {
  const total = list.reduce((s, x) => s + x[weightKey], 0);
  let r = Math.random() * total;
  for (const item of list) {
    r -= item[weightKey];
    if (r <= 0) return item;
  }
  return list[list.length - 1];
}

// modifier chance scales slightly by rarity — rarer cards are a little more likely to roll a "real" modifier
function drawModifierForRarity(rarity) {
  const boost = { Common: 0, Uncommon: 0.05, Rare: 0.1, Mythic: 0.2, Legendary: 0.3 }[rarity] || 0;
  if (Math.random() < 0.4 + boost) {
    // pick from real modifiers only (exclude "none")
    return pickWeighted(MODIFIERS.slice(1));
  }
  return MODIFIERS[0];
}
