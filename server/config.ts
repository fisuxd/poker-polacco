const positiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: positiveNumber(process.env.PORT, 3000),
  turnMs: positiveNumber(process.env.TURN_SECONDS, 45) * 1_000,
  reconnectMs: positiveNumber(process.env.RECONNECT_SECONDS, 60) * 1_000,
  revealMs: positiveNumber(process.env.REVEAL_SECONDS, 2) * 1_000,
  resultMs: positiveNumber(process.env.RESULT_SECONDS, 3) * 1_000,
  roundStartMs: 900,
  debug: process.env.ENABLE_DEBUG === "true" && process.env.NODE_ENV !== "production",
  production: process.env.NODE_ENV === "production",
};
