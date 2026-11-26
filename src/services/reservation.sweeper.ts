import { releaseExpiredReservations } from './coupon.release';

export const DEFAULT_SWEEP_INTERVAL_MS = 30_000;

/** Starts the periodic expiry sweep. The timer is unref'd so it never keeps the process alive. */
export function startReservationSweeper(
  intervalMs: number = DEFAULT_SWEEP_INTERVAL_MS,
): NodeJS.Timeout {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    releaseExpiredReservations()
      .catch((err: unknown) => {
        console.error('Reservation sweep failed:', err);
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return timer;
}
