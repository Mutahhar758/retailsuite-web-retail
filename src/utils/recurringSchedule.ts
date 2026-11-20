import dayjs, { type Dayjs } from 'dayjs';
import type { RecurrenceFrequency } from '../services/recurringChainService';

export interface SchedulePreviewInput {
  frequency?: RecurrenceFrequency | string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  interval?: number;
  startDate?: Dayjs | string | null;
}

function startOfWeekMonday(date: Dayjs): Dayjs {
  const offset = (date.day() + 6) % 7;
  return date.subtract(offset, 'day').startOf('day');
}

export function isScheduleDueOn(input: SchedulePreviewInput, date: Dayjs): boolean {
  const d = date.startOf('day');
  const startDate = input.startDate ? dayjs(input.startDate).startOf('day') : null;
  if (startDate && d.isBefore(startDate)) return false;

  const anchor = startDate ?? dayjs().startOf('day');
  const freq = input.frequency || 'Daily';
  const days = (input.daysOfWeek ?? []).filter((x) => x >= 0 && x <= 6);
  const interval = Math.max(1, Number(input.interval) || 1);

  if (freq === 'Daily') {
    if (days.length > 0 && days.length < 7) {
      return days.includes(d.day());
    }
    if (interval === 1) return true;
    const diff = d.diff(anchor, 'day');
    return diff >= 0 && diff % interval === 0;
  }

  if (freq === 'Weekly') {
    if (days.length === 0 || !days.includes(d.day())) return false;
    if (interval === 1) return true;
    const weeksDiff = Math.round(startOfWeekMonday(d).diff(startOfWeekMonday(anchor), 'day') / 7);
    return weeksDiff >= 0 && weeksDiff % interval === 0;
  }

  if (freq === 'BiWeekly') {
    if (days.length === 0 || !days.includes(d.day())) return false;
    const weeksDiff = Math.round(startOfWeekMonday(d).diff(startOfWeekMonday(anchor), 'day') / 7);
    return weeksDiff >= 0 && weeksDiff % 2 === 0;
  }

  if (freq === 'Monthly') {
    if (interval > 1) {
      const monthsDiff = (d.year() - anchor.year()) * 12 + (d.month() - anchor.month());
      if (monthsDiff < 0 || monthsDiff % interval !== 0) return false;
    }
    const targetDay = Math.min(Math.max(Number(input.dayOfMonth) || 1, 1), 31);
    const effectiveDay = Math.min(targetDay, d.daysInMonth());
    return d.date() === effectiveDay;
  }

  return false;
}

export function getUpcomingDates(input: SchedulePreviewInput, count = 5, maxLookaheadDays = 400): Dayjs[] {
  const results: Dayjs[] = [];
  const today = dayjs().startOf('day');
  const startDate = input.startDate ? dayjs(input.startDate).startOf('day') : null;
  const scanStart = startDate && startDate.isAfter(today) ? startDate : today;

  for (let i = 0; i < maxLookaheadDays && results.length < count; i++) {
    const candidate = scanStart.add(i, 'day');
    if (isScheduleDueOn(input, candidate)) {
      results.push(candidate);
    }
  }

  return results;
}
