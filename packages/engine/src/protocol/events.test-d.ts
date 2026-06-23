// Type-level test (checked by `tsc`, not run by Vitest — the filename is
// `.test-d.ts`, which the test runner's glob ignores).
//
// This is the concrete proof for Story 2.2 AC2: "an intentionally wrong event
// payload is a compile error." If someone weakens the protocol so the wrong
// payload below no longer errors, the `@ts-expect-error` becomes an unused
// directive and `npm run typecheck` fails — exactly the guard we want.

import type { ClientToServerEvents } from './events.js';

// The payload type, extracted straight from the event signature.
type JoinPayload = Parameters<ClientToServerEvents['match:join']>[0];

// A correct payload compiles.
const good: JoinPayload = { matchId: 'm-1', nickname: 'Luffy' };

// @ts-expect-error - nickname must be a string, not a number.
const badNicknameType: JoinPayload = { matchId: 'm-1', nickname: 123 };

// @ts-expect-error - matchId is required.
const missingMatchId: JoinPayload = { nickname: 'Luffy' };

// Reference the bindings so noUnusedLocals stays happy.
void good;
void badNicknameType;
void missingMatchId;
