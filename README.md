# SET Multiplayer — Web App

Real-time multiplayer SET card game. Mobile-first PWA built with React + Vite (frontend) and Node + Socket.io (backend).

## Features
- 2–4 players in private rooms (shareable link/code)
- No accounts — just enter a name
- SVG cards faithful to the original game
- Thinking time countdown after claiming a SET
- Configurable: thinking time (3–30 s), penalty on/off (−5 pts)
- 10 pts for a valid SET, −5 penalty for a wrong one
- Game ends when the deck is exhausted and no SETs remain
- Installable as a PWA

---

## Quick start (local dev)

### 1. Server

```bash
cd server
npm install
npm run dev      # starts on http://localhost:3001
```

### 2. Client

```bash
cd client
npm install
npm run dev      # starts on http://localhost:5173
```

Open `http://localhost:5173` in multiple browser tabs to test multiplayer.

---

## Environment variables

### Client (`client/.env.local`)
```
VITE_SERVER_URL=http://localhost:3001
```
In production, point this at your deployed server URL.

---

## Deployment

### Server (Railway / Render / Fly.io)
1. Deploy the `server/` directory as a Node.js service.
2. Set the `PORT` env variable if your host requires it (defaults to 3001).

### Client (Vercel / Netlify)
1. Set `VITE_SERVER_URL` to your deployed server URL.
2. Build: `npm run build` → deploy the `dist/` folder.

---

## Project structure

```
set-game/
├── server/
│   ├── server.js       # Express + Socket.io server
│   ├── gameLogic.js    # Pure game logic (deck, validation, SET finding)
│   └── package.json
└── client/
    ├── src/
    │   ├── App.jsx         # Root component + all socket event handling
    │   ├── socket.js       # Socket.io client instance
    │   ├── index.css       # All styles (mobile-first)
    │   ├── components/
    │   │   └── Card.jsx    # SVG card renderer
    │   └── pages/
    │       ├── Home.jsx    # Name entry, create/join room
    │       ├── Lobby.jsx   # Waiting room + settings
    │       ├── Game.jsx    # Main game board
    │       └── Results.jsx # End screen + scoreboard
    ├── vite.config.js
    └── package.json
```

---

## Game rules (quick reference)

A **SET** is a group of 3 cards where, for each of the 4 attributes (number, color, shape, shading), the values across the 3 cards are either **all the same** or **all different**.

- Press **"I found a SET!"** to claim — you then have the configured thinking time to tap 3 cards.
- Valid SET → **+10 pts**, cards replaced from deck.
- Invalid SET → **−5 pts** (if penalty enabled).
- Time runs out → **−5 pts** (if penalty enabled).
- Game ends when the deck is empty and no SETs remain on the board.
