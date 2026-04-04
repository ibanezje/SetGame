/**
 * SET Game Logic
 * Pure functions — no side effects, fully testable.
 */

const NUMBERS  = [1, 2, 3];
const COLORS   = ['red', 'green', 'purple'];
const SHAPES   = ['oval', 'diamond', 'squiggle'];
const SHADINGS = ['solid', 'striped', 'open'];

/** Build and shuffle a full 81-card deck */
function createDeck() {
  const deck = [];
  for (const number of NUMBERS)
    for (const color of COLORS)
      for (const shape of SHAPES)
        for (const shading of SHADINGS)
          deck.push({ number, color, shape, shading });

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function allSameOrAllDiff(a, b, c) {
  const s = new Set([a, b, c]).size;
  return s === 1 || s === 3;
}

function isValidSet(a, b, c) {
  if (!a || !b || !c) return false;
  return (
    allSameOrAllDiff(a.number,  b.number,  c.number)  &&
    allSameOrAllDiff(a.color,   b.color,   c.color)   &&
    allSameOrAllDiff(a.shape,   b.shape,   c.shape)   &&
    allSameOrAllDiff(a.shading, b.shading, c.shading)
  );
}

function findAllSets(board) {
  const sets = [];
  for (let i = 0; i < board.length - 2; i++)
    for (let j = i + 1; j < board.length - 1; j++)
      for (let k = j + 1; k < board.length; k++)
        if (isValidSet(board[i], board[j], board[k]))
          sets.push([i, j, k]);
  return sets;
}

/**
 * Deal cards onto the board, fill up to minCards then expand if no SET.
 * Returns how many extra cards were dealt beyond minCards (0 = no expansion).
 */
function dealCards(deck, board, minCards = 12) {
  while (board.length < minCards && deck.length > 0)
    board.push(deck.pop());

  let extra = 0;
  while (findAllSets(board).length === 0 && deck.length > 0) {
    for (let i = 0; i < 3 && deck.length > 0; i++) {
      board.push(deck.pop());
      extra++;
    }
  }
  return extra;
}

/**
 * After a valid SET is removed, refill the board.
 * Returns how many extra cards were dealt beyond normal refill (0 = no expansion).
 */
function refillAfterSet(deck, board, boardSizeBeforeRemoval) {
  if (boardSizeBeforeRemoval <= 12) {
    while (board.length < 12 && deck.length > 0)
      board.push(deck.pop());
  }

  let extra = 0;
  while (findAllSets(board).length === 0 && deck.length > 0) {
    for (let i = 0; i < 3 && deck.length > 0; i++) {
      board.push(deck.pop());
      extra++;
    }
  }
  return extra;
}

module.exports = { createDeck, isValidSet, findAllSets, dealCards, refillAfterSet };
