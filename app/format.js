// Display helpers shared by every view: escaping, money, dates, countdowns.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('783.00' or 0.5) as '$783' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** A count with thousands separators. */
export function count(value) {
  return Number(value ?? 0).toLocaleString('en-US');
}

/** A deadline as a UTC date and time. */
export function dateTime(iso) {
  return `${new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** A date alone, UTC. */
export function dateOnly(iso) {
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
}

/** True once the deadline has passed, whatever the API status still says. */
export function isClosed(bounty, now = Date.now()) {
  return new Date(bounty.deadline).getTime() <= now;
}

/** The time until a deadline: '3d 4h', '4h 12m', '9m', or 'ended'. */
export function timeLeft(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
}

/** Urgency class for a countdown chip: 'hot' under 2h, 'warm' under 24h. */
export function urgency(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'ended';
  if (ms < 2 * 3_600_000) return 'hot';
  if (ms < 24 * 3_600_000) return 'warm';
  return '';
}

/** A judge win rate in millionths as a percentage: 956066 -> '95.6%'. */
export function winRate(micro) {
  if (micro == null) return '—';
  return `${(Number(micro) / 10_000).toFixed(1)}%`;
}

/** A wallet address shortened for display. */
export function shortAddress(address) {
  if (!address) return '';
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** A relative '3h ago' for timestamps. */
export function ago(iso, now = Date.now()) {
  const ms = now - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours > 0) return `${hours}h ago`;
  const minutes = Math.floor(ms / 60_000);
  return minutes > 0 ? `${minutes}m ago` : 'just now';
}
