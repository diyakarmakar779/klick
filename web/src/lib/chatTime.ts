// Times in chats: a clock time today, then "Yesterday", a weekday within the week, and a date after that.
const DAY = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysAgo = (iso: string) => Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / DAY);

export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function rowTime(iso: string) {
  const n = daysAgo(iso);
  if (n <= 0) return clockTime(iso);
  if (n === 1) return "Yesterday";
  if (n < 7) return new Date(iso).toLocaleDateString("en-GB", { weekday: "short" });
  return shortDay(iso);
}

export function dayLabel(iso: string) {
  const n = daysAgo(iso);
  return n <= 0 ? "Today" : n === 1 ? "Yesterday" : shortDay(iso);
}

export const sameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));
