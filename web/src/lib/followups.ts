// "Due today", "Due Friday", "3 days overdue". Overdue is shown in warning colour.
export function dueLabel(dueAt: string) {
  const days = Math.round((new Date(dueAt).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days < 0) return { text: days === -1 ? "Due yesterday" : `${-days} days overdue`, overdue: true };
  if (days === 0) return { text: "Due today", overdue: false };
  if (days === 1) return { text: "Due tomorrow", overdue: false };
  return { text: `Due ${new Date(dueAt).toLocaleDateString("en-IN", { weekday: days < 7 ? "long" : undefined, day: days < 7 ? undefined : "numeric", month: days < 7 ? undefined : "short" })}`, overdue: false };
}
