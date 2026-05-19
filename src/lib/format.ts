export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
  notation: "compact"
});

export const whole = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

export const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1
});

export function quarterLabel(period: string) {
  const date = new Date(`${period}T00:00:00Z`);
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()} Q${quarter}`;
}

export function compactDate(date: string) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(`${date}T00:00:00Z`));
}
