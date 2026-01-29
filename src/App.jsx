import React, { useState, useEffect } from 'react'
import DocumentScanner from './components/DocumentScanner'
import ReminderList from './components/ReminderList'
import {
  isNotificationSupported,
  requestNotificationPermission,
  scheduleNotifications,
  clearAllScheduledNotifications
} from './services/notificationService'
import {
  requestGoogleAccessToken,
  fetchGoogleUserProfile
} from './services/googleOAuthService'
import './App.css'

function App() {
  const [reminders, setReminders] = useState([])
  const [notificationStatus, setNotificationStatus] = useState('default')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [oauthUser, setOauthUser] = useState(null)
  const [oauthStatus, setOauthStatus] = useState('signed-out')
  const [oauthError, setOauthError] = useState('')

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
    const savedUser = localStorage.getItem('rakall-oauth-user')
    if (savedUser) {
      setOauthUser(JSON.parse(savedUser))
      setOauthStatus('signed-in')
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
    if (notificationStatus === 'unsupported') {
      setNotificationMessage('Notifications are not supported in this browser.')
      return
    }

    if (notificationStatus === 'denied') {
      setNotificationMessage('Notifications are blocked in your browser settings. Please allow them for this site and refresh.')
      return
    }

    if (notificationsEnabled) {
      setNotificationsEnabled(false)
      localStorage.setItem('rakall-notifications-enabled', 'false')
      clearAllScheduledNotifications()
      setNotificationMessage('Notifications paused.')
      return
    }

    const permission = await requestNotificationPermission()
    setNotificationStatus(permission)
    if (permission === 'granted') {
      setNotificationsEnabled(true)
      localStorage.setItem('rakall-notifications-enabled', 'true')
      setNotificationMessage('Notifications enabled.')
    } else if (permission === 'denied') {
      setNotificationMessage('Notifications were blocked. Please allow them in browser settings.')
    }
  }

  const handleGoogleSignIn = async () => {
    setOauthError('')
    setOauthStatus('loading')

    try {
      const tokenResponse = await requestGoogleAccessToken({
        scope: 'openid email profile'
      })
      const profile = await fetchGoogleUserProfile(tokenResponse.access_token)
      setOauthUser(profile)
      setOauthStatus('signed-in')
      localStorage.setItem('rakall-oauth-user', JSON.stringify(profile))
    } catch (error) {
      setOauthStatus('signed-out')
      setOauthError(error.message || 'Google sign-in failed.')
    }
  }

  const handleGoogleSignOut = () => {
    setOauthUser(null)
    setOauthStatus('signed-out')
    setOauthError('')
    localStorage.removeItem('rakall-oauth-user')
  }

  return (
    <div className="app">
      <div className="app-shell">
        <aside className="app-menu">
          <div className="menu-brand">
            <img src="/logo.png" alt="RAKALL Logo" className="menu-logo" />
            <div>
              <h2>RAKALL</h2>
              <p>AI Reminder</p>
            </div>
          </div>
          <nav className="menu-nav">
            <a href="#dashboard" className="menu-link">Dashboard</a>
            <a href="#scanner" className="menu-link">AI Scanner</a>
            <a href="#reminders" className="menu-link">Reminders</a>
            <a href="#settings" className="menu-link">Settings</a>
          </nav>
        </aside>

        <div className="app-content">
          <header id="dashboard" className="app-header">
            <img src="/logo.png" alt="RAKALL Logo" className="app-logo" />
            <h1>RAKALL</h1>
            <p>AI-Powered Reminder App</p>
          </header>
          
          <main className="app-main">
            <section id="scanner" className="app-section">
              <DocumentScanner onReminderCreated={addReminder} />
            </section>
            <section id="reminders" className="app-section">
              <ReminderList 
                reminders={reminders}
                onDelete={deleteReminder}
                onUpdate={updateReminder}
              />
            </section>
            <section id="settings" className="app-section app-settings">
              <h3>Settings</h3>
              <div className="oauth-section">
                <p className="oauth-title">Google Sign-in</p>
                {oauthUser ? (
                  <div className="oauth-user">
                    <div>
                      <p className="oauth-name">{oauthUser.name || 'Signed in'}</p>
                      <p className="oauth-email">{oauthUser.email || ''}</p>
                    </div>
                    <button className="oauth-button secondary" onClick={handleGoogleSignOut}>
                      Sign out
                    </button>
                  </div>
                ) : (
                  <button
                    className="oauth-button"
                    onClick={handleGoogleSignIn}
                    disabled={oauthStatus === 'loading'}
                  >
                    {oauthStatus === 'loading' ? 'Connecting...' : 'Sign in with Google'}
                  </button>
                )}
                {oauthError && <p className="oauth-error">{oauthError}</p>}
              </div>
              <div className="notification-controls">
                <button
                  className="notification-button"
                  onClick={toggleNotifications}
                >
                  {notificationStatus === 'denied' && 'Notifications blocked'}
                  {notificationStatus === 'unsupported' && 'Notifications not supported'}
                  {notificationStatus === 'granted' && (notificationsEnabled ? 'Block Notifications' : 'Enable Notifications')}
                  {notificationStatus === 'default' && 'Enable Notifications'}
                </button>
              </div>
              {notificationMessage && (
                <p className="notification-message">{notificationMessage}</p>
              )}
              <p className="notification-hint">
                Notifications work while the app is open in your browser.
              </p>
              <p>Coming soon: reminders sync, advanced schedules, and themes.</p>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
