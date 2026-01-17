import React, { useState, useRef, useEffect } from 'react'
import { extractDocumentInfo } from '../services/aiService'
import { extractTasksFromText } from '../services/textExtractionService'
import './DocumentScanner.css'

// Helper function to calculate reminder date based on period
function calculateReminderDate(deadlineDate, periodType = '1 day') {
  const deadline = new Date(deadlineDate)
  const reminderDate = new Date(deadline)
  
  // Parse period type and subtract accordingly
  const periodMap = {
    '1 day': 1,
    '3 days': 3,
    '1 week': 7,
    '2 weeks': 14,
    '3 weeks': 21,
    '1 month': 30,
    '2 months': 60,
    '3 months': 90,
    '6 months': 180,
    '1 year': 365
  }
  
  const daysToSubtract = periodMap[periodType] || 1
  reminderDate.setDate(reminderDate.getDate() - daysToSubtract)
  
  return reminderDate.toISOString().split('T')[0]
}

function DocumentScanner({ onReminderCreated }) {
  // Tab state
  const [activeTab, setActiveTab] = useState('document') // 'document' or 'text'
  
  // Document scanner states
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [extractedInfo, setExtractedInfo] = useState(null)
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [reminderPeriod, setReminderPeriod] = useState('1 day')
  const [error, setError] = useState(null)
  const [autoCreate, setAutoCreate] = useState(true)
  const [successMessage, setSuccessMessage] = useState(null)
  
  // Text scanner states
  const [text, setText] = useState('')
  const [textLoading, setTextLoading] = useState(false)
  const [suggestedTasks, setSuggestedTasks] = useState([])
  const [expandedTask, setExpandedTask] = useState(null)
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false)
  const [stream, setStream] = useState(null)
  const [cameraAvailable, setCameraAvailable] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  // Check camera availability on mount
  useEffect(() => {
    const checkCameraAvailability = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const hasVideoInput = devices.some(device => device.kind === 'videoinput')
          setCameraAvailable(hasVideoInput)
        } catch (err) {
          setCameraAvailable(true)
        }
      } else {
        setCameraAvailable(false)
      }
    }
    checkCameraAvailability()
  }, [])

  // Document scanner functions
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result)
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  const handleScan = async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const base64 = await fileToBase64(file)
      const info = await extractDocumentInfo(base64, file.type)
      
      setExtractedInfo(info)
      
      if (info.billName) {
        setReminderTitle(`Pay ${info.billName}`)
      }
      
      if (info.deadlineDate) {
        setDeadlineDate(info.deadlineDate)
        const calculatedReminderDate = calculateReminderDate(info.deadlineDate, reminderPeriod)
        setReminderDate(calculatedReminderDate)
      }
      
      if (info.time) {
        setReminderTime(info.time)
      } else {
        setReminderTime('09:00')
      }
      
      if (autoCreate && info.billName && info.deadlineDate) {
        setTimeout(() => {
          handleCreateReminderAuto(info)
        }, 500)
      }
    } catch (err) {
      setError(err.message || 'Failed to process document')
      console.error('Scan error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateReminderAuto = (info) => {
    const calculatedReminderDate = calculateReminderDate(info.deadlineDate, reminderPeriod)
    const reminder = {
      title: `Pay ${info.billName}`,
      date: calculatedReminderDate,
      deadlineDate: info.deadlineDate,
      reminderPeriod: reminderPeriod,
      time: info.time || '09:00',
      description: info.description || '',
      documentPreview: preview,
      extractedInfo: info
    }

    onReminderCreated(reminder)
    
    setSuccessMessage(`✅ Reminder created! Reminder set ${reminderPeriod} before deadline (${info.deadlineDate})`)
    setTimeout(() => setSuccessMessage(null), 5000)
    
    resetDocumentForm()
  }

  const handleCreateReminder = () => {
    if (!reminderTitle || !reminderDate) {
      setError('Please fill in title and date')
      return
    }

    const reminder = {
      title: reminderTitle,
      date: reminderDate,
      deadlineDate: deadlineDate || extractedInfo?.deadlineDate || reminderDate,
      reminderPeriod: reminderPeriod,
      time: reminderTime || '09:00',
      description: extractedInfo?.description || '',
      documentPreview: preview,
      extractedInfo: extractedInfo
    }

    onReminderCreated(reminder)
    resetDocumentForm()
  }

  const resetDocumentForm = () => {
    setFile(null)
    setPreview(null)
    setExtractedInfo(null)
    setReminderTitle('')
    setReminderDate('')
    setDeadlineDate('')
    setReminderTime('')
    setReminderPeriod('1 day')
    setError(null)
    
    const fileInput = document.getElementById('file-input')
    if (fileInput) fileInput.value = ''
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = error => reject(error)
    })
  }

  // Text scanner functions
  const handleExtractText = async () => {
    if (!text.trim()) {
      setError('Please enter some text to analyze')
      return
    }

    setTextLoading(true)
    setError(null)
    setSuggestedTasks([])

    try {
      const tasks = await extractTasksFromText(text)
      setSuggestedTasks(tasks)
      
      if (tasks.length === 0) {
        setError('No tasks or reminders found in the text. Try adding more specific information.')
      }
    } catch (err) {
      setError(err.message || 'Failed to extract tasks from text')
      console.error('Extraction error:', err)
    } finally {
      setTextLoading(false)
    }
  }

  const handleApproveTask = (task, index) => {
    const reminder = {
      title: task.title,
      date: task.date,
      time: task.time || '09:00',
      description: task.description,
      reminderPeriod: '1 day',
      isSuggested: true,
      confidence: task.confidence
    }

    onReminderCreated(reminder)
    setSuggestedTasks(suggestedTasks.filter((_, i) => i !== index))
    showSuccessNotification('✅ Reminder added!')
  }

  const handleRejectTask = (index) => {
    setSuggestedTasks(suggestedTasks.filter((_, i) => i !== index))
  }

  const handleEditTask = (task, index) => {
    setExpandedTask(expandedTask === index ? null : index)
  }

  const handleSaveEditTask = (index, editedTask) => {
    const updated = [...suggestedTasks]
    updated[index] = { ...updated[index], ...editedTask }
    setSuggestedTasks(updated)
    setExpandedTask(null)
  }

  const showSuccessNotification = (message) => {
    const successMsg = document.createElement('div')
    successMsg.className = 'approval-success'
    successMsg.textContent = message
    successMsg.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%);
      color: white;
      padding: 15px 25px;
      border-radius: 12px;
      z-index: 10000;
      box-shadow: 0 6px 25px rgba(255, 107, 53, 0.5);
      font-weight: 600;
      animation: slideInRight 0.3s ease-out;
    `
    document.body.appendChild(successMsg)
    
    setTimeout(() => {
      successMsg.style.opacity = '0'
      successMsg.style.transition = 'opacity 0.3s'
      setTimeout(() => document.body.removeChild(successMsg), 300)
    }, 3000)
  }

  // Camera functions
  const startCamera = async () => {
    try {
      setError(null)
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported in this browser. Please use a modern browser or upload a file instead.')
        return
      }

      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1'
      
      if (!isSecure) {
        setError('Camera access requires HTTPS. Please use a secure connection or upload a file instead.')
        return
      }

      let mediaStream = null
      
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        })
      } catch (backCameraError) {
        console.log('Back camera not available, trying default camera...', backCameraError)
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          })
        } catch (frontCameraError) {
          console.log('Front camera not available, trying any camera...', frontCameraError)
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          })
        }
      }

      if (mediaStream) {
        setStream(mediaStream)
        setShowCamera(true)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      }
    } catch (err) {
      console.error('Camera error:', err)
      
      let errorMessage = 'Unable to access camera. '
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage += 'Camera permission was denied. Please allow camera access in your browser settings and try again.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage += 'No camera found on this device. Please use the file upload option instead.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage += 'Camera is already in use by another application. Please close other apps using the camera and try again.'
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        errorMessage += 'Camera does not support the required settings. Please use the file upload option instead.'
      } else if (err.name === 'NotSupportedError') {
        errorMessage += 'Camera access is not supported. Please use a modern browser or upload a file instead.'
      } else {
        errorMessage += 'Please check your camera permissions or use the file upload option instead.'
      }
      
      setError(errorMessage)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setShowCamera(false)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      context.setTransform(1, 0, 0, 1, 0, 0)
      
      canvas.toBlob((blob) => {
        if (blob) {
          const capturedFile = new File([blob], 'camera-capture.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now()
          })
          
          setFile(capturedFile)
          setPreview(canvas.toDataURL('image/jpeg'))
          stopCamera()
        }
      }, 'image/jpeg', 0.95)
    }
  }

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  return (
    <div className="document-scanner">
      <div className="scanner-header">
        <h2>🤖 AI Scanner</h2>
        <div className="tab-buttons">
          <button
            className={activeTab === 'document' ? 'active' : ''}
            onClick={() => {
              setActiveTab('document')
              setError(null)
              setSuccessMessage(null)
            }}
          >
            📄 Document
          </button>
          <button
            className={activeTab === 'text' ? 'active' : ''}
            onClick={() => {
              setActiveTab('text')
              setError(null)
              setSuccessMessage(null)
            }}
          >
            ✍️ Text
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* Document Scanner Tab */}
      {activeTab === 'document' && (
        <>
          <div className="upload-section">
            <div className="upload-buttons">
              <label htmlFor="file-input" className="upload-label">
                {preview ? '📁 Change File' : '📁 Choose Document'}
              </label>
              <input
                id="file-input"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="file-input"
              />
              
              {cameraAvailable && (
                <button 
                  onClick={showCamera ? stopCamera : startCamera}
                  className="camera-button"
                >
                  {showCamera ? '❌ Close Camera' : '📷 Take Photo'}
                </button>
              )}
            </div>
            
            {showCamera && (
              <div className="camera-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="camera-video"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div className="camera-controls">
                  <button onClick={capturePhoto} className="capture-button">
                    📸 Capture
                  </button>
                </div>
              </div>
            )}
            
            {preview && !showCamera && (
              <div className="preview-container">
                <img src={preview} alt="Preview" className="preview-image" />
                <button 
                  onClick={() => {
                    setPreview(null)
                    setFile(null)
                    const fileInput = document.getElementById('file-input')
                    if (fileInput) fileInput.value = ''
                  }}
                  className="remove-preview-button"
                >
                  ✕ Remove
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={handleScan} 
            disabled={!file || loading}
            className="scan-button"
          >
            {loading ? '🔄 Processing...' : '🤖 Extract Information with AI'}
          </button>

          {extractedInfo && (
            <div className="extracted-info">
              <h3>Extracted Information:</h3>
              <div className="info-item">
                <strong>Bill Name:</strong> {extractedInfo.billName || 'Not found'}
              </div>
              <div className="info-item">
                <strong>Deadline Date:</strong> {extractedInfo.deadlineDate || 'Not found'}
              </div>
              <div className="info-item highlight">
                <strong>⏰ Reminder Date ({reminderPeriod} before):</strong> {reminderDate || 'Calculating...'}
              </div>
              <div className="info-item">
                <strong>Amount:</strong> {extractedInfo.amount || 'Not found'}
              </div>
              {extractedInfo.description && (
                <div className="info-item">
                  <strong>Description:</strong> {extractedInfo.description}
                </div>
              )}
            </div>
          )}

          <div className="reminder-form">
            <div className="auto-create-toggle">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoCreate}
                  onChange={(e) => setAutoCreate(e.target.checked)}
                />
                <span>Auto-create reminder after scanning</span>
              </label>
            </div>

            <h3>Create Reminder</h3>
            
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="e.g., Pay electricity bill"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Reminder Type (How early to remind) *</label>
              <select
                value={reminderPeriod}
                onChange={(e) => {
                  setReminderPeriod(e.target.value)
                  if (deadlineDate) {
                    const newReminderDate = calculateReminderDate(deadlineDate, e.target.value)
                    setReminderDate(newReminderDate)
                  }
                }}
                className="form-input"
              >
                <option value="1 day">1 Day Before</option>
                <option value="3 days">3 Days Before</option>
                <option value="1 week">1 Week Before</option>
                <option value="2 weeks">2 Weeks Before</option>
                <option value="3 weeks">3 Weeks Before</option>
                <option value="1 month">1 Month Before</option>
                <option value="2 months">2 Months Before</option>
                <option value="3 months">3 Months Before</option>
                <option value="6 months">6 Months Before</option>
                <option value="1 year">1 Year Before</option>
              </select>
              <small className="form-hint">Choose how early you want to be reminded before the deadline</small>
            </div>

            <div className="form-group">
              <label>Reminder Date *</label>
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="form-input"
              />
              <small className="form-hint">Automatically calculated based on deadline and reminder type</small>
            </div>

            {deadlineDate && (
              <div className="form-group">
                <label>Original Deadline Date</label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => {
                    setDeadlineDate(e.target.value)
                    const newReminderDate = calculateReminderDate(e.target.value, reminderPeriod)
                    setReminderDate(newReminderDate)
                  }}
                  className="form-input"
                  readOnly={!extractedInfo}
                />
                <small className="form-hint">Deadline extracted from document</small>
              </div>
            )}

            <div className="form-group">
              <label>Time</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="form-input"
              />
            </div>

            <button 
              onClick={handleCreateReminder}
              className="create-button"
              disabled={!reminderTitle || !reminderDate}
            >
              ✅ Create Reminder
            </button>
          </div>
        </>
      )}

      {/* Text Scanner Tab */}
      {activeTab === 'text' && (
        <>
          <div className="text-input-section">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your text here... e.g., 'I need to call John tomorrow at 2 PM about the project. Also, pay the electricity bill next week.'"
              className="text-input"
              rows={8}
            />
            
            <button 
              onClick={handleExtractText} 
              disabled={!text.trim() || textLoading}
              className="extract-button"
            >
              {textLoading ? '🔄 Analyzing...' : '✨ Extract Tasks'}
            </button>
          </div>

          {suggestedTasks.length > 0 && (
            <div className="suggestions-section">
              <h3>📋 Suggested Reminders ({suggestedTasks.length})</h3>
              <div className="suggestions-list">
                {suggestedTasks.map((task, index) => (
                  <div key={index} className="suggestion-card">
                    {expandedTask === index ? (
                      <TaskEditor
                        task={task}
                        onSave={(edited) => handleSaveEditTask(index, edited)}
                        onCancel={() => setExpandedTask(null)}
                      />
                    ) : (
                      <>
                        <div className="suggestion-header">
                          <div className="suggestion-content">
                            <h4>{task.title}</h4>
                            <div className="suggestion-meta">
                              <span className="suggestion-date"><img src="/logo.png" alt="Logo" className="inline-logo" /> {task.date}</span>
                              {task.time && <span className="suggestion-time">🕐 {task.time}</span>}
                              <span className="confidence-badge" style={{
                                background: (task.confidence || 0.7) > 0.8 ? 'rgba(16, 185, 129, 0.2)' : 
                                           (task.confidence || 0.7) > 0.6 ? 'rgba(255, 193, 7, 0.2)' : 
                                           'rgba(239, 68, 68, 0.2)',
                                color: (task.confidence || 0.7) > 0.8 ? '#10b981' : 
                                      (task.confidence || 0.7) > 0.6 ? '#fbbf24' : '#ef4444'
                              }}>
                                {Math.round((task.confidence || 0.7) * 100)}% confident
                              </span>
                            </div>
                            {task.description && (
                              <p className="suggestion-description">{task.description}</p>
                            )}
                            {task.sourceText && (
                              <p className="suggestion-source">Source: "{task.sourceText}..."</p>
                            )}
                          </div>
                        </div>
                        <div className="suggestion-actions">
                          <button
                            onClick={() => handleEditTask(task, index)}
                            className="edit-button"
                            title="Edit reminder"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleRejectTask(index)}
                            className="reject-button"
                            title="Dismiss"
                          >
                            ✕ Dismiss
                          </button>
                          <button
                            onClick={() => handleApproveTask(task, index)}
                            className="approve-button"
                            title="Add reminder"
                          >
                            ✅ Add Reminder
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestedTasks.length > 0 && (
            <button
              onClick={() => {
                setSuggestedTasks([])
                setText('')
                setError(null)
              }}
              className="clear-button"
            >
              Clear All
            </button>
          )}
        </>
      )}
    </div>
  )
}

function TaskEditor({ task, onSave, onCancel }) {
  const [editedTask, setEditedTask] = useState({
    title: task.title,
    date: task.date,
    time: task.time || '',
    description: task.description || ''
  })

  const handleSave = () => {
    onSave(editedTask)
  }

  return (
    <div className="task-editor">
      <div className="editor-field">
        <label>Title</label>
        <input
          type="text"
          value={editedTask.title}
          onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
          className="editor-input"
        />
      </div>
      <div className="editor-row">
        <div className="editor-field">
          <label>Date</label>
          <input
            type="date"
            value={editedTask.date}
            onChange={(e) => setEditedTask({ ...editedTask, date: e.target.value })}
            className="editor-input"
          />
        </div>
        <div className="editor-field">
          <label>Time</label>
          <input
            type="time"
            value={editedTask.time}
            onChange={(e) => setEditedTask({ ...editedTask, time: e.target.value })}
            className="editor-input"
          />
        </div>
      </div>
      <div className="editor-field">
        <label>Description</label>
        <textarea
          value={editedTask.description}
          onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
          className="editor-input"
          rows={3}
        />
      </div>
      <div className="editor-actions">
        <button onClick={onCancel} className="cancel-button">Cancel</button>
        <button onClick={handleSave} className="save-button">Save</button>
      </div>
    </div>
  )
}

export default DocumentScanner
