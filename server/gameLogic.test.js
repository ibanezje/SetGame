const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createDeck, isValidSet, findAllSets, dealCards, refillAfterSet } = require('./gameLogic');

describe('createDeck', () => {
  it('produces exactly 81 cards', () => {
    const deck = createDeck();
    assert.equal(deck.length, 81);
  });

  it('every card has a unique id', () => {
    const deck = createDeck();
    const ids = deck.map(c => c.id);
    assert.equal(new Set(ids).size, 81);
  });

  it('card id matches its properties', () => {
    const deck = createDeck();
    for (const card of deck) {
      assert.equal(card.id, `${card.number}-${card.color}-${card.shape}-${card.shading}`);
    }
  });
});

describe('isValidSet', () => {
  it('accepts a valid SET (all different on every property)', () => {
    const a = { id: '1-red-oval-solid',       number: 1, color: 'red',    shape: 'oval',     shading: 'solid' };
    const b = { id: '2-green-diamond-striped', number: 2, color: 'green',  shape: 'diamond',  shading: 'striped' };
    const c = { id: '3-purple-squiggle-open',  number: 3, color: 'purple', shape: 'squiggle', shading: 'open' };
    assert.equal(isValidSet(a, b, c), true);
  });

  it('accepts a valid SET (all same color, all different rest)', () => {
    const a = { id: '1-red-oval-solid',      number: 1, color: 'red', shape: 'oval',     shading: 'solid' };
    const b = { id: '2-red-diamond-striped',  number: 2, color: 'red', shape: 'diamond',  shading: 'striped' };
    const c = { id: '3-red-squiggle-open',    number: 3, color: 'red', shape: 'squiggle', shading: 'open' };
    assert.equal(isValidSet(a, b, c), true);
  });

  it('rejects an invalid SET (two same, one different on a property)', () => {
    const a = { id: '1-red-oval-solid',      number: 1, color: 'red',   shape: 'oval',    shading: 'solid' };
    const b = { id: '2-red-diamond-striped',  number: 2, color: 'red',   shape: 'diamond', shading: 'striped' };
    const c = { id: '3-green-squiggle-open',  number: 3, color: 'green', shape: 'squiggle', shading: 'open' };
    assert.equal(isValidSet(a, b, c), false);
  });

  it('returns false for null/undefined cards', () => {
    assert.equal(isValidSet(null, null, null), false);
    assert.equal(isValidSet(undefined, { number: 1, color: 'red', shape: 'oval', shading: 'solid' }, null), false);
  });
});

describe('findAllSets', () => {
  it('finds SETs on a known board', () => {
    const board = [
      { id: '1-red-oval-solid',       number: 1, color: 'red',    shape: 'oval',     shading: 'solid' },
      { id: '2-green-diamond-striped', number: 2, color: 'green',  shape: 'diamond',  shading: 'striped' },
      { id: '3-purple-squiggle-open',  number: 3, color: 'purple', shape: 'squiggle', shading: 'open' },
      { id: '1-green-oval-solid',      number: 1, color: 'green',  shape: 'oval',     shading: 'solid' },
    ];
    const sets = findAllSets(board);
    assert.equal(sets.length, 1);
    assert.deepEqual(sets[0], [0, 1, 2]);
  });

  it('returns empty when no SET exists', () => {
    const board = [
      { id: '1-red-oval-solid',      number: 1, color: 'red',    shape: 'oval',    shading: 'solid' },
      { id: '2-red-oval-solid',      number: 2, color: 'red',    shape: 'oval',    shading: 'solid' },
      { id: '1-green-diamond-solid', number: 1, color: 'green',  shape: 'diamond', shading: 'solid' },
    ];
    const sets = findAllSets(board);
    assert.equal(sets.length, 0);
  });
});

describe('dealCards', () => {
  it('fills board to 12 cards', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);
    assert.ok(board.length >= 12);
    assert.equal(deck.length, 81 - board.length);
  });

  it('board contains a SET after dealing (or deck is empty)', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);
    if (deck.length > 0) {
      assert.ok(findAllSets(board).length > 0, 'Board must contain a SET after dealing');
    }
  });

  it('all dealt cards have unique IDs', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);
    const ids = board.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length, 'Board must not contain duplicate IDs');
  });
});

describe('refillAfterSet', () => {
  it('refills board to 12 after removal from 12-card board', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);

    const sets = findAllSets(board);
    if (sets.length === 0) return;

    const [i, j, k] = sets[0];
    const removedIds = [board[i].id, board[j].id, board[k].id];
    const boardSizeBefore = board.length;
    const remaining = board.filter(c => !removedIds.includes(c.id));
    board.length = 0;
    remaining.forEach(c => board.push(c));

    refillAfterSet(deck, board, boardSizeBefore);
    assert.ok(board.length >= 12 || deck.length === 0);
  });

  it('no duplicate IDs after refill', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);

    const sets = findAllSets(board);
    if (sets.length === 0) return;

    const [i, j, k] = sets[0];
    const removedIds = [board[i].id, board[j].id, board[k].id];
    const boardSizeBefore = board.length;
    const remaining = board.filter(c => !removedIds.includes(c.id));
    board.length = 0;
    remaining.forEach(c => board.push(c));

    refillAfterSet(deck, board, boardSizeBefore);

    const ids = board.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length, 'No duplicate IDs after refill');
  });
});
