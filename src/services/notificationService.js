const MAX_TIMEOUT_MS = 2147483647 // ~24.8 days
const scheduledTimers = new Map()

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export function clearAllScheduledNotifications() {
  scheduledTimers.forEach(timeoutId => clearTimeout(timeoutId))
  scheduledTimers.clear()
}

export function scheduleNotifications(reminders) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    clearAllScheduledNotifications()
    return
  }

  clearAllScheduledNotifications()

  const now = new Date()

  reminders.forEach(reminder => {
    if (reminder.completed) return

    const time = reminder.time || '09:00'
    const triggerDate = new Date(`${reminder.date}T${time}`)
    const delay = triggerDate.getTime() - now.getTime()

    if (Number.isNaN(triggerDate.getTime()) || delay <= 0) return
    if (delay > MAX_TIMEOUT_MS) return

    const timeoutId = setTimeout(() => {
      showReminderNotification(reminder)
      scheduledTimers.delete(reminder.id)
    }, delay)

    scheduledTimers.set(reminder.id, timeoutId)
  })
}

function showReminderNotification(reminder) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return

  const bodyParts = []
  if (reminder.deadlineDate) bodyParts.push(`Due: ${reminder.deadlineDate}`)
  if (reminder.time) bodyParts.push(`Time: ${reminder.time}`)
  if (reminder.description) bodyParts.push(reminder.description)

  const body = bodyParts.filter(Boolean).join(' • ')

  new Notification(reminder.title || 'Reminder', {
    body,
    icon: '/logo.png',
    tag: `reminder-${reminder.id}`
  })
}
