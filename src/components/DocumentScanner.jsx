import React, { useState, useRef, useEffect } from 'react'
import { extractDocumentInfo } from '../services/aiService'
import './DocumentScanner.css'

// Helper function to calculate reminder date (3 days before deadline)
function calculateReminderDate(deadlineDate) {
  const deadline = new Date(deadlineDate)
  const reminderDate = new Date(deadline)
  reminderDate.setDate(reminderDate.getDate() - 3)
  return reminderDate.toISOString().split('T')[0]
}

function DocumentScanner({ onReminderCreated }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [extractedInfo, setExtractedInfo] = useState(null)
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [error, setError] = useState(null)
  const [autoCreate, setAutoCreate] = useState(true)
  const [successMessage, setSuccessMessage] = useState(null)
  
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
          // Check if we can enumerate devices
          const devices = await navigator.mediaDevices.enumerateDevices()
          const hasVideoInput = devices.some(device => device.kind === 'videoinput')
          setCameraAvailable(hasVideoInput)
        } catch (err) {
          // If enumeration fails, assume camera might be available
          setCameraAvailable(true)
        }
      } else {
        setCameraAvailable(false)
      }
    }
    checkCameraAvailability()
  }, [])

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      
      // Create preview
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
      // Convert file to base64 for AI processing
      const base64 = await fileToBase64(file)
      
      // Extract information using AI
      const info = await extractDocumentInfo(base64, file.type)
      
      setExtractedInfo(info)
      
      // Pre-fill form with extracted data
      if (info.billName) {
        setReminderTitle(`Pay ${info.billName}`)
      }
      
      if (info.deadlineDate) {
        setDeadlineDate(info.deadlineDate)
        // Automatically calculate reminder date (3 days before deadline)
        const calculatedReminderDate = calculateReminderDate(info.deadlineDate)
        setReminderDate(calculatedReminderDate)
      }
      
      if (info.time) {
        setReminderTime(info.time)
      } else {
        setReminderTime('09:00') // Default time
      }
      
      // Auto-create reminder if enabled
      if (autoCreate && info.billName && info.deadlineDate) {
        // Small delay to show extracted info first
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
    const calculatedReminderDate = calculateReminderDate(info.deadlineDate)
    const reminder = {
      title: `Pay ${info.billName}`,
      date: calculatedReminderDate,
      deadlineDate: info.deadlineDate,
      time: info.time || '09:00',
      description: info.description || '',
      documentPreview: preview,
      extractedInfo: info
    }

    onReminderCreated(reminder)
    
    // Show success message
    setSuccessMessage(`✅ Reminder created! Reminder set for 3 days before deadline (${info.deadlineDate})`)
    setTimeout(() => setSuccessMessage(null), 5000)
    
    // Reset form
    setFile(null)
    setPreview(null)
    setExtractedInfo(null)
    setReminderTitle('')
    setReminderDate('')
    setDeadlineDate('')
    setReminderTime('')
    setError(null)
    
    // Reset file input
    const fileInput = document.getElementById('file-input')
    if (fileInput) fileInput.value = ''
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
      time: reminderTime || '09:00',
      description: extractedInfo?.description || '',
      documentPreview: preview,
      extractedInfo: extractedInfo
    }

    onReminderCreated(reminder)
    
    // Reset form
    setFile(null)
    setPreview(null)
    setExtractedInfo(null)
    setReminderTitle('')
    setReminderDate('')
    setDeadlineDate('')
    setReminderTime('')
    setError(null)
    
    // Reset file input
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

  // Camera functions
  const startCamera = async () => {
    try {
      setError(null)
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported in this browser. Please use a modern browser or upload a file instead.')
        return
      }

      // Check if we're on HTTPS or localhost (required for camera access)
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1'
      
      if (!isSecure) {
        setError('Camera access requires HTTPS. Please use a secure connection or upload a file instead.')
        return
      }

      let mediaStream = null
      
      // Try back camera first (for mobile document scanning)
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        })
      } catch (backCameraError) {
        // If back camera fails, try any available camera
        console.log('Back camera not available, trying default camera...', backCameraError)
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user', // Front camera or default
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          })
        } catch (frontCameraError) {
          // If that also fails, try without facingMode constraint
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
      
      // Provide specific error messages based on error type
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
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      // Flip the context horizontally to un-mirror the image
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Reset transform
      context.setTransform(1, 0, 0, 1, 0, 0)
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          // Create a File object from the blob
          const capturedFile = new File([blob], 'camera-capture.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now()
          })
          
          // Set the file and preview
          setFile(capturedFile)
          setPreview(canvas.toDataURL('image/jpeg'))
          
          // Stop camera
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
      <h2>📄 Scan Document</h2>
      
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

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

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
            <strong>⏰ Reminder Date (3 days before):</strong> {reminderDate || 'Calculating...'}
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
          <label>Reminder Date (3 days before deadline) *</label>
          <input
            type="date"
            value={reminderDate}
            onChange={(e) => setReminderDate(e.target.value)}
            className="form-input"
          />
          <small className="form-hint">Automatically set to 3 days before deadline</small>
        </div>

        {deadlineDate && (
          <div className="form-group">
            <label>Original Deadline Date</label>
            <input
              type="date"
              value={deadlineDate}
              onChange={(e) => {
                setDeadlineDate(e.target.value)
                // Recalculate reminder date when deadline changes
                const newReminderDate = calculateReminderDate(e.target.value)
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
    </div>
  )
}

export default DocumentScanner
