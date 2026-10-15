// Opening hours by weekday (0 = Sunday), 24h clock. Keep in sync with the Hours section on the site.
const HOURS = [[10, 16], [9, 20], [9, 20], [9, 20], [9, 20], [9, 20], [8, 18]];
const SLOT_MINUTES = 30;
const TZ = process.env.TIMEZONE || 'America/Toronto';
const pad = (n) => String(n).padStart(2, '0');
const noon = (date) => new Date(date + 'T12:00:00Z');

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = noon(s);
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function shopNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
}

function slotsFor(date) {
  const [open, close] = HOURS[noon(date).getUTCDay()];
  const out = [];
  for (let m = open * 60; m <= close * 60 - SLOT_MINUTES; m += SLOT_MINUTES) {
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return out;
}

function isPast(date, time) {
  const now = shopNow();
  if (date < now.date) return true;
  if (date > now.date) return false;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m <= now.minutes;
}

function labelFor(time) {
  const [h, m] = time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? 'pm' : 'am'}`;
}

function longDate(date) {
  return noon(date).toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  });
}

module.exports = { isValidDate, slotsFor, isPast, labelFor, longDate };
