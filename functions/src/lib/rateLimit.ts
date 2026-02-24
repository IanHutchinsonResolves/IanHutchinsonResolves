export function isRateLimited(
  lastCheckInAt: Date | null,
  now: Date,
  windowHours = 24
): boolean {
  if (!lastCheckInAt) {
    return false;
  }
  const diffMs = now.getTime() - lastCheckInAt.getTime();
  const windowMs = windowHours * 60 * 60 * 1000;
  return diffMs < windowMs;
}
