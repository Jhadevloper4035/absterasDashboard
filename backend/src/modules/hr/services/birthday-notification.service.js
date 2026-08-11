import { User } from '../../../models/user.model.js';
import { Notification } from '../../notifications/models/notification.model.js';
import { invalidateCache } from '../../../services/redis-cache.service.js';
import { Employee } from '../models/employee.model.js';

const dateParts = (date, timeZone) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

export const isBirthdayToday = (dateOfBirth, now, timeZone = 'UTC') => {
  if (!dateOfBirth) return false;
  const birthday = new Date(dateOfBirth);
  if (Number.isNaN(birthday.getTime())) return false;
  const today = dateParts(now, timeZone);
  return String(birthday.getUTCMonth() + 1).padStart(2, '0') === today.month && String(birthday.getUTCDate()).padStart(2, '0') === today.day;
};

export async function sendBirthdayNotifications(now = new Date()) {
  const [employees, users] = await Promise.all([
    Employee.find({ status: 'active', dateOfBirth: { $exists: true } }).populate('user', 'name timezone status'),
    User.find({ status: 'active' }).select('_id'),
  ]);
  let created = 0;
  for (const employee of employees) {
    const birthdayPerson = employee.user;
    if (!birthdayPerson || birthdayPerson.status !== 'active' || !isBirthdayToday(employee.dateOfBirth, now, birthdayPerson.timezone || 'UTC')) continue;
    const date = dateParts(now, birthdayPerson.timezone || 'UTC');
    const results = await Promise.all(users.map((user) => Notification.updateOne(
      { idempotencyKey: `birthday:${employee._id}:${date.year}-${date.month}-${date.day}:${user._id}` },
      { $setOnInsert: { user: user._id, channel: 'in-app', title: 'Today’s birthday', body: `Today is ${birthdayPerson.name}'s birthday.`, status: 'sent', metadata: { type: 'hr.birthday', employeeId: employee._id } } },
      { upsert: true },
    )));
    created += results.reduce((total, result) => total + Number(result.upsertedCount || 0), 0);
  }
  if (created) await invalidateCache('unread-notifications');
  return created;
}

export function startBirthdayNotifier() {
  const run = () => sendBirthdayNotifications().catch((error) => console.error('Birthday notification job failed', error));
  run();
  return setInterval(run, 60 * 60 * 1000);
}
