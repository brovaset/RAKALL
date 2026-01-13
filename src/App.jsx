import React, { useState, useEffect } from 'react'
import DocumentScanner from './components/DocumentScanner'
import ReminderList from './components/ReminderList'
import './App.css'

function App() {
  const [reminders, setReminders] = useState([])

  // Load reminders from localStorage on mount
  useEffect(() => {
    const savedReminders = localStorage.getItem('rakall-reminders')
    if (savedReminders) {
      setReminders(JSON.parse(savedReminders))
    }
  }, [])

  // Save reminders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('rakall-reminders', JSON.stringify(reminders))
  }, [reminders])

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

  return (
    <div className="app">
      <header className="app-header">
        <h1>📅 RAKALL</h1>
        <p>AI-Powered Reminder App</p>
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
