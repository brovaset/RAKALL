import React, { useState, useEffect } from 'react'
import DocumentScanner from './components/DocumentScanner'
import ReminderList from './components/ReminderList'
import {
  isNotificationSupported,
  requestNotificationPermission,
  scheduleNotifications,
  clearAllScheduledNotifications
} from './services/notificationService'
import './App.css'

function App() {
  const [reminders, setReminders] = useState([])
  const [notificationStatus, setNotificationStatus] = useState('default')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  // Load reminders from localStorage on mount
  useEffect(() => {
    const savedReminders = localStorage.getItem('rakall-reminders')
    if (savedReminders) {
      setReminders(JSON.parse(savedReminders))
    }
    const savedNotifEnabled = localStorage.getItem('rakall-notifications-enabled')
    if (savedNotifEnabled) {
      setNotificationsEnabled(savedNotifEnabled === 'true')
    }
  }, [])

  useEffect(() => {
    if (!isNotificationSupported()) {
      setNotificationStatus('unsupported')
      return
    }
    setNotificationStatus(Notification.permission)
  }, [])

  // Save reminders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('rakall-reminders', JSON.stringify(reminders))
  }, [reminders])

  useEffect(() => {
    if (notificationsEnabled && notificationStatus === 'granted') {
      scheduleNotifications(reminders)
    } else {
      clearAllScheduledNotifications()
    }
    return () => clearAllScheduledNotifications()
  }, [reminders, notificationsEnabled, notificationStatus])

  const addReminder = (reminder) => {
    const newReminder = {
      id: Date.now(),
      ...reminder,
      createdAt: new Date().toISOString()
    }
    setReminders([...reminders, newReminder])
  }

  const deleteReminder = (id) => {
    setReminders(reminders.filter(r => r.id !== id))
  }

  const updateReminder = (id, updates) => {
    setReminders(reminders.map(r => 
      r.id === id ? { ...r, ...updates } : r
    ))
  }

  const toggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false)
      localStorage.setItem('rakall-notifications-enabled', 'false')
      clearAllScheduledNotifications()
      return
    }

    const permission = await requestNotificationPermission()
    setNotificationStatus(permission)
    if (permission === 'granted') {
      setNotificationsEnabled(true)
      localStorage.setItem('rakall-notifications-enabled', 'true')
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <img src="/logo.png" alt="RAKALL Logo" className="app-logo" />
        <h1>RAKALL</h1>
        <p>AI-Powered Reminder App</p>
        <div className="notification-controls">
          <span className={`notification-status ${notificationStatus}`}>
            {notificationStatus === 'granted' && (notificationsEnabled ? 'Notifications enabled' : 'Notifications paused')}
            {notificationStatus === 'denied' && 'Notifications blocked'}
            {notificationStatus === 'default' && 'Notifications off'}
            {notificationStatus === 'unsupported' && 'Notifications not supported'}
          </span>
          <button
            className="notification-button"
            onClick={toggleNotifications}
            disabled={notificationStatus === 'unsupported'}
          >
            {notificationsEnabled ? 'Block Notifications' : 'Enable Notifications'}
          </button>
        </div>
        <p className="notification-hint">
          Notifications work while the app is open in your browser.
        </p>
      </header>
      
      <main className="app-main">
        <DocumentScanner onReminderCreated={addReminder} />
        <ReminderList 
          reminders={reminders}
          onDelete={deleteReminder}
          onUpdate={updateReminder}
        />
      </main>
    </div>
  )
}

export default App
