import { env } from '../config/env.js';

const minutes = (time) => {
  const [hour, minute] = String(time || '').split(':').map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : null;
};

export function calculateAttendance({ employeeType, status, checkIn, checkOut }) {
  const start = minutes(env.attendance.shiftStart);
  const end = minutes(env.attendance.shiftEnd);
  const arrived = minutes(checkIn);
  const left = minutes(checkOut);
  const isWorkingDay = status === 'present' || status === 'late';
  const workMinutes = isWorkingDay && arrived !== null && left !== null && left >= arrived ? left - arrived : 0;
  const isLate = isWorkingDay && arrived !== null && arrived > start;
  return {
    status: isLate && arrived > 16 * 60 ? 'half-day' : isLate ? 'late' : status,
    workMinutes,
    isShortLeave: isLate && workMinutes < 8 * 60,
    overtimeMinutes: employeeType === 'site' && isWorkingDay && left !== null && left > end ? left - end : 0,
  };
}
