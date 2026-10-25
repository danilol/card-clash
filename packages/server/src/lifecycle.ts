// Set once SIGTERM/SIGINT starts the graceful shutdown (story 4.2 review).
// Socket handlers read it: io.close() disconnects every socket, and those
// disconnects must not be mistaken for players leaving.
let shuttingDown = false;

// Returns false when shutdown already started, so a second signal is a no-op.
export function beginShutdown(): boolean {
  if (shuttingDown) return false;
  shuttingDown = true;
  return true;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}
