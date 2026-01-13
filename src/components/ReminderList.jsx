import React, { useState } from 'react'
import { format, isPast, isToday, isTomorrow, parseISO } from 'date-fns'
import './ReminderList.css'

function ReminderList({ reminders, onDelete, onUpdate }) {
  const [filter, setFilter] = useState('all') // all, upcoming, past

  const filteredReminders = reminders.filter(reminder => {
    if (filter === 'all') return true
    const reminderDate = parseISO(`${reminder.date}T${reminder.time || '00:00'}`)
    if (filter === 'upcoming') return !isPast(reminderDate)
    if (filter === 'past') return isPast(reminderDate)
    return true
  })

  const sortedReminders = [...filteredReminders].sort((a, b) => {
    const dateA = parseISO(`${a.date}T${a.time || '00:00'}`)
    const dateB = parseISO(`${b.date}T${b.time || '00:00'}`)
    return dateA - dateB
  })

  const getDateLabel = (dateString, timeString) => {
    const date = parseISO(`${dateString}T${timeString || '00:00'}`)
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    if (isPast(date)) return 'Past'
    return format(date, 'MMM dd, yyyy')
  }

  const getDateStatus = (dateString, timeString) => {
    const date = parseISO(`${dateString}T${timeString || '00:00'}`)
    if (isPast(date)) return 'past'
    if (isToday(date)) return 'today'
    if (isTomorrow(date)) return 'tomorrow'
    return 'upcoming'
  }

  const toggleCompleted = (id) => {
    const reminder = reminders.find(r => r.id === id)
    onUpdate(id, { completed: !reminder.completed })
  }

  return (
    <div className="reminder-list">
      <div className="reminder-header">
        <h2>📋 Reminders</h2>
        <div className="filter-buttons">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'upcoming' ? 'active' : ''}
            onClick={() => setFilter('upcoming')}
          >
            Upcoming
          </button>
          <button
            className={filter === 'past' ? 'active' : ''}
            onClick={() => setFilter('past')}
          >
            Past
          </button>
        </div>
      </div>

      {sortedReminders.length === 0 ? (
        <div className="empty-state">
          <p>No reminders yet. Scan a document to create one!</p>
        </div>
      ) : (
        <div className="reminders-container">
          {sortedReminders.map(reminder => {
            const status = getDateStatus(reminder.date, reminder.time)
            const dateLabel = getDateLabel(reminder.date, reminder.time)
            
            return (
              <div
                key={reminder.id}
                className={`reminder-card ${status} ${reminder.completed ? 'completed' : ''}`}
              >
                {reminder.documentPreview && (
                  <div className="reminder-image">
                    <img src={reminder.documentPreview} alt="Document" />
                  </div>
                )}
                
                <div className="reminder-content">
                  <div className="reminder-header-row">
                    <h3 className={reminder.completed ? 'strikethrough' : ''}>
                      {reminder.title}
                    </h3>
                    <button
                      onClick={() => onDelete(reminder.id)}
                      className="delete-button"
                      title="Delete reminder"
                    >
                      🗑️
                    </button>
                  </div>
                  
                  <div className="reminder-date-time">
                    <span className="date-label">{dateLabel}</span>
                    <span className="time-label">
                      {reminder.time || 'All day'}
                    </span>
                  </div>
                  
                  {reminder.deadlineDate && reminder.deadlineDate !== reminder.date && (
                    <div className="deadline-info">
                      <strong>📅 Deadline:</strong> {format(parseISO(reminder.deadlineDate), 'MMM dd, yyyy')}
                      <span className="deadline-note">(Reminder set 3 days before)</span>
                    </div>
                  )}
                  
                  {reminder.description && (
                    <p className="reminder-description">{reminder.description}</p>
                  )}
                  
                  {reminder.extractedInfo?.amount && (
                    <div className="reminder-amount">
                      <strong>Amount:</strong> {reminder.extractedInfo.amount}
                    </div>
                  )}
                  
                  <div className="reminder-actions">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={reminder.completed || false}
                        onChange={() => toggleCompleted(reminder.id)}
                      />
                      <span>Mark as completed</span>
                    </label>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ReminderList
