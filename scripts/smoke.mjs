// Smoke test against a RUNNING card-clash server (dev, dist, or container):
// create a match over REST, join two socket clients, play one round.
// Usage: node scripts/smoke.mjs [baseUrl]   (default http://localhost:3000)
import { io } from 'socket.io-client';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const results = [];
const ok = (name, pass, detail = '') =>
  results.push(
    `${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`,
  );

const connect = () =>
  new Promise((resolve, reject) => {
    const s = io(BASE, { transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
const join = (sock, matchId, nickname) =>
  new Promise((resolve) =>
    sock.emit('match:join', { matchId, nickname }, resolve),
  );
const once = (sock, event, ms = 15000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${event}`)), ms);
    sock.once(event, (p) => {
      clearTimeout(t);
      resolve(p);
    });
  });

const res = await fetch(`${BASE}/api/matches`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ nickname: 'Smoke' }),
});
const { matchId } = await res.json();
ok('create match (REST)', typeof matchId === 'string');

const [a, b] = [await connect(), await connect()];
const ackA = await join(a, matchId, 'Luffy');
const stateA = once(a, 'match:state');
const stateB = once(b, 'match:state');
const ackB = await join(b, matchId, 'Zoro');
const [viewA, viewB] = await Promise.all([stateA, stateB]);
ok(
  'join + deal (16 cards each)',
  viewA.yourStackCount === 16 && viewB.yourStackCount === 16,
);

const chooserIsA = viewA.chooser === viewA.you;
const [chooserSock, chooserAck, chooserView] = chooserIsA
  ? [a, ackA, viewA]
  : [b, ackB, viewB];
const nextA = once(a, 'match:state');
const nextB = once(b, 'match:state');
chooserSock.emit('match:selectStat', {
  matchId,
  token: chooserAck.token,
  stat: chooserView.statDefinitions[0].key,
});
const [afterA] = await Promise.all([nextA, nextB]);
ok(
  'one round resolved',
  afterA.roundsPlayed === 1 && afterA.lastRound !== null,
);

a.disconnect();
b.disconnect();
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
