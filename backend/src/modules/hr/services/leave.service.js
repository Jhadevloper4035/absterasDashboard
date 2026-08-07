export const dayAtMidnight = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function leaveDays(fromDate, toDate, holidayDates = []) {
  const from = dayAtMidnight(fromDate); const to = dayAtMidnight(toDate);
  if (!from || !to || to < from) return 0;
  const holidays = new Set(holidayDates.map((date) => new Date(date).toISOString().slice(0, 10)));
  let days = 0;
  for (let day = new Date(from); day <= to; day.setUTCDate(day.getUTCDate() + 1)) if (!holidays.has(day.toISOString().slice(0, 10))) days += 1;
  return days;
}

export function leaveAttendanceDates(fromDate, toDate, holidayDates = []) {
  const from = dayAtMidnight(fromDate); const to = dayAtMidnight(toDate); const holidays = new Set(holidayDates.map((date) => new Date(date).toISOString().slice(0, 10))); const dates = [];
  for (let day = from; day && to && day <= to; day.setUTCDate(day.getUTCDate() + 1)) if (!holidays.has(day.toISOString().slice(0, 10))) dates.push(new Date(day));
  return dates;
}
