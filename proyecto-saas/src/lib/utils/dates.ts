import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addHours,
} from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export function formatDate(
  date: string | Date,
  fmt = "dd/MM/yyyy"
): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt, { locale: es });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy HH:mm", { locale: es });
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (isToday(d)) return `Hoy, ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Mañana, ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Ayer, ${format(d, "HH:mm")}`;
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

export function toWorkspaceTz(date: Date, timezone: string): Date {
  return toZonedTime(date, timezone);
}

export function fromWorkspaceTz(date: Date, timezone: string): Date {
  return fromZonedTime(date, timezone);
}

export function getWeekRange(date: Date) {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function getMonthRange(date: Date) {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

export function getDayRange(date: Date) {
  return { start: startOfDay(date), end: endOfDay(date) };
}

export { addDays, addHours, parseISO, format, isToday, isTomorrow };
