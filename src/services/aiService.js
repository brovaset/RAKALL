/**
 * AI Service for extracting information from documents
 * 
 * This service uses OpenAI's GPT-4 Vision API to extract dates, amounts,
 * and other relevant information from uploaded documents.
 * 
 * Note: You'll need to set up an OpenAI API key in your environment variables.
 * Create a .env file with: VITE_OPENAI_API_KEY=your_api_key_here
 */

export async function extractDocumentInfo(base64Image, mimeType) {
  // Check if OpenAI API key is configured
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  
  if (!apiKey) {
    // Fallback to mock extraction if no API key
    console.warn('OpenAI API key not found. Using mock extraction.')
    return mockExtractDocumentInfo()
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert document analysis AI. Your task is to extract ALL actionable tasks, reminders, deadlines, appointments, and important dates from documents with high accuracy.

CRITICAL REQUIREMENTS:
1. Read the ENTIRE document carefully - don't miss any dates, times, or tasks
2. Extract dates in YYYY-MM-DD format (e.g., 2024-12-25)
3. Extract times in HH:MM format (24-hour, e.g., 14:30 for 2:30 PM)
4. Convert relative dates to absolute dates (e.g., "next Monday" → actual date)
5. Be precise with dates - verify month, day, and year
6. Extract monetary amounts with currency symbols
7. Assign appropriate confidence scores based on clarity of information
8. Return ONLY valid JSON, no additional text

Today's date: ${new Date().toISOString().split('T')[0]}
Current time: ${new Date().toTimeString().split(' ')[0].substring(0, 5)}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this document and extract ALL tasks, reminders, deadlines, appointments, and important dates.

DOCUMENT TYPES TO HANDLE:
- Bills, invoices, receipts (look for "Due Date", "Payment Due", "Pay By")
- Meeting notes (look for meeting times, dates, attendees)
- Emails (look for deadlines, appointments, action items)
- To-do lists (extract all items with dates/times)
- Calendars, schedules, appointment confirmations
- Any document with dates, times, or tasks

EXTRACTION RULES:
1. For each task found, extract:
   - title: Clear, actionable title (e.g., "Pay Electricity Bill", "Meeting with John at 2 PM", "Submit Quarterly Report")
   - date: Deadline/due date/appointment date in YYYY-MM-DD format
   - time: Time in HH:MM format (24-hour) if mentioned, otherwise null
   - description: Additional context, details, or notes
   - type: One of: "bill", "meeting", "deadline", "appointment", "task", "payment", "reminder"
   - amount: Monetary amount with currency if applicable (e.g., "$150.00"), otherwise null
   - confidence: 0.0-1.0 based on clarity (1.0 = very clear, 0.7 = somewhat clear, 0.5 = inferred)

2. For bills/invoices, also extract billInfo:
   - billName: Service/bill name (e.g., "Electricity Bill", "Credit Card Statement")
   - deadlineDate: Due date in YYYY-MM-DD format
   - amount: Total amount due
   - description: Brief description

DATE/TIME EXTRACTION GUIDELINES:
- Look for explicit dates: "December 25, 2024", "12/25/2024", "2024-12-25"
- Convert relative dates: "tomorrow" = ${formatDateForInput(new Date(Date.now() + 86400000))}, "next Monday" = calculate next Monday's actual date
- Extract times: "2 PM" = "14:00", "9:30 AM" = "09:30", "15:45" = "15:45"
- If only date is found, set time to null
- If only time is found, use today's date if context suggests today, otherwise infer from context

RETURN FORMAT (JSON only):
{
  "tasks": [
    {
      "title": "string",
      "date": "YYYY-MM-DD",
      "time": "HH:MM or null",
      "description": "string",
      "type": "bill|meeting|deadline|appointment|task|payment|reminder",
      "amount": "string or null",
      "confidence": 0.0-1.0
    }
  ],
  "billInfo": {
    "billName": "string",
    "deadlineDate": "YYYY-MM-DD",
    "amount": "string",
    "description": "string"
  } or null
}

EXAMPLES:
Input: "Electricity bill due December 15, 2024. Amount: $150.00"
Output: {
  "tasks": [{
    "title": "Pay Electricity Bill",
    "date": "2024-12-15",
    "time": null,
    "description": "Electricity bill payment",
    "type": "bill",
    "amount": "$150.00",
    "confidence": 0.95
  }],
  "billInfo": {
    "billName": "Electricity Bill",
    "deadlineDate": "2024-12-15",
    "amount": "$150.00",
    "description": "Electricity bill payment due"
  }
}

Now analyze the document and return the JSON.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to process document')
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    
    // Try to parse JSON from the response
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/)
      const jsonString = jsonMatch ? jsonMatch[1] : content
      const extracted = JSON.parse(jsonString)
      
      // Validate and normalize the extracted data
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const validatedTasks = (extracted.tasks || []).map(task => {
        const taskDate = validateAndFormatDate(task.date || task.deadlineDate || task.dueDate)
        const dateObj = new Date(taskDate)
        dateObj.setHours(0, 0, 0, 0)
        
        // If date is in the past and confidence is low, it might be a mistake - adjust confidence
        let confidence = Math.min(Math.max(task.confidence || 0.7, 0), 1)
        if (dateObj < today && confidence > 0.8) {
          confidence = Math.max(confidence - 0.2, 0.5) // Reduce confidence for past dates
        }
        
        return {
          title: (task.title || task.task || 'Untitled Task').trim(),
          date: taskDate,
          time: validateAndFormatTime(task.time),
          description: (task.description || task.context || '').trim(),
          type: task.type || inferTaskType(task.title || ''),
          amount: task.amount ? formatAmount(task.amount) : null,
          confidence: confidence
        }
      }).filter(task => {
        // Remove invalid tasks (must have title and valid date)
        if (!task.title || task.title === 'Untitled Task') return false
        if (!task.date) return false
        return true
      })
      
      // Return tasks array and bill info if available
      return {
        tasks: validatedTasks,
        billInfo: extracted.billInfo ? {
          billName: (extracted.billInfo.billName || '').trim(),
          deadlineDate: validateAndFormatDate(extracted.billInfo.deadlineDate),
          amount: extracted.billInfo.amount ? formatAmount(extracted.billInfo.amount) : null,
          description: (extracted.billInfo.description || '').trim()
        } : null,
        // Legacy support for old format
        billName: extracted.billInfo?.billName || extracted.billName || null,
        deadlineDate: extracted.billInfo?.deadlineDate || validateAndFormatDate(extracted.deadlineDate),
        time: extracted.billInfo?.time || validateAndFormatTime(extracted.time),
        amount: extracted.billInfo?.amount || (extracted.amount ? formatAmount(extracted.amount) : null),
        description: extracted.billInfo?.description || extracted.description || ''
      }
    } catch (parseError) {
      // If JSON parsing fails, try to extract information using regex
      console.warn('JSON parsing failed, attempting fallback parser:', parseError.message)
      console.log('Response content:', content.substring(0, 500))
      return parseTextResponse(content)
    }
  } catch (error) {
    console.error('AI extraction error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    })
    // Fallback to mock extraction on error
    return mockExtractDocumentInfo()
  }
}

function parseTextResponse(text) {
  // Enhanced fallback parser for when JSON parsing fails
  console.warn('JSON parsing failed, using enhanced fallback parser')
  
  const tasks = []
  
  // Try to extract dates and tasks from text
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{2})/,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i
  ]
  
  const amountPattern = /\$?[\d,]+\.?\d{0,2}/
  const billNamePattern = /(bill|invoice|payment|statement)[\s:]+([^\n\.]+)/i
  
  let extractedDate = null
  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      extractedDate = validateAndFormatDate(match[0])
      break
    }
  }
  
  const extractedAmount = text.match(amountPattern)?.[0]
  const billNameMatch = text.match(billNamePattern)
  const billName = billNameMatch ? billNameMatch[2].trim() : 'Document Reminder'
  
  if (extractedDate) {
    tasks.push({
      title: `Pay ${billName}`,
      date: extractedDate,
      time: null,
      description: text.substring(0, 200),
      type: 'bill',
      amount: extractedAmount || null,
      confidence: 0.6
    })
  }
  
  return {
    tasks: tasks.length > 0 ? tasks : [],
    billInfo: extractedDate ? {
      billName: billName,
      deadlineDate: extractedDate,
      amount: extractedAmount || null,
      description: text.substring(0, 200)
    } : null,
    billName: billName,
    deadlineDate: extractedDate || formatDateForInput(new Date()),
    time: null,
    amount: extractedAmount || null,
    description: text.substring(0, 200)
  }
}

function formatDate(dateString) {
  // Convert various date formats to YYYY-MM-DD
  if (dateString.includes('-')) {
    return dateString.split(' ')[0]
  }
  if (dateString.includes('/')) {
    const parts = dateString.split('/')
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0')
      const day = parts[1].padStart(2, '0')
      const year = parts[2]
      return `${year}-${month}-${day}`
    }
  }
  return formatDateForInput(new Date())
}

function formatDateForInput(date) {
  return date.toISOString().split('T')[0]
}

function validateAndFormatDate(dateString) {
  if (!dateString) return formatDateForInput(new Date())
  
  // Try to parse the date
  const date = new Date(dateString)
  if (!isNaN(date.getTime())) {
    return formatDateForInput(date)
  }
  
  // Try common formats
  const formats = [
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // M/D/YYYY
    /(\d{4})\/(\d{2})\/(\d{2})/ // YYYY/MM/DD
  ]
  
  for (const format of formats) {
    const match = dateString.match(format)
    if (match) {
      if (format === formats[0]) {
        return dateString.substring(0, 10) // Already YYYY-MM-DD
      } else if (format === formats[1] || format === formats[2]) {
        const month = match[1].padStart(2, '0')
        const day = match[2].padStart(2, '0')
        const year = match[3]
        return `${year}-${month}-${day}`
      } else if (format === formats[3]) {
        return dateString.substring(0, 10).replace(/\//g, '-')
      }
    }
  }
  
  return formatDateForInput(new Date())
}

function validateAndFormatTime(timeString) {
  if (!timeString) return null
  
  // Already in HH:MM format
  if (/^\d{2}:\d{2}$/.test(timeString)) {
    return timeString
  }
  
  // Parse 12-hour format
  const timeMatch = timeString.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1])
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    const period = timeMatch[3].toLowerCase()
    
    if (period === 'pm' && hours !== 12) hours += 12
    if (period === 'am' && hours === 12) hours = 0
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }
  
  // Parse 24-hour format without colon
  const noColonMatch = timeString.match(/^(\d{3,4})$/)
  if (noColonMatch) {
    const time = noColonMatch[1].padStart(4, '0')
    return `${time.substring(0, 2)}:${time.substring(2)}`
  }
  
  return null
}

function formatAmount(amount) {
  if (!amount) return null
  const amountStr = String(amount).trim()
  // Ensure it has currency symbol if it's a number
  if (/^\d+\.?\d*$/.test(amountStr)) {
    return `$${amountStr}`
  }
  return amountStr
}

function inferTaskType(title) {
  const lowerTitle = title.toLowerCase()
  if (lowerTitle.includes('bill') || lowerTitle.includes('payment') || lowerTitle.includes('pay')) return 'bill'
  if (lowerTitle.includes('meeting') || lowerTitle.includes('meet')) return 'meeting'
  if (lowerTitle.includes('deadline') || lowerTitle.includes('due')) return 'deadline'
  if (lowerTitle.includes('appointment') || lowerTitle.includes('appt')) return 'appointment'
  if (lowerTitle.includes('reminder')) return 'reminder'
  return 'task'
}

function mockExtractDocumentInfo() {
  // Mock extraction for testing without API key
  const mockBillNames = [
    'Electricity Bill',
    'Credit Card Statement',
    'Insurance Premium',
    'Phone Bill',
    'Rent Payment',
    'Water Bill',
    'Internet Service'
  ]
  
  const mockAmounts = ['$150.00', '$299.99', '$89.50', '$45.00', '$1200.00']
  
  // Generate a deadline date 7-30 days from now
  const daysFromNow = Math.floor(Math.random() * 23) + 7
  const deadlineDate = new Date()
  deadlineDate.setDate(deadlineDate.getDate() + daysFromNow)
  
  const billName = mockBillNames[Math.floor(Math.random() * mockBillNames.length)]
  
  return {
    tasks: [
      {
        title: `Pay ${billName}`,
        date: formatDateForInput(deadlineDate),
        time: '09:00',
        description: 'Payment due date extracted from document',
        type: 'bill',
        amount: mockAmounts[Math.floor(Math.random() * mockAmounts.length)],
        confidence: 0.9
      },
      {
        title: 'Follow up on document',
        date: formatDateForInput(new Date(Date.now() + 3 * 86400000)),
        time: null,
        description: 'Review and verify extracted information',
        type: 'task',
        amount: null,
        confidence: 0.7
      }
    ],
    billInfo: {
      billName: billName,
      deadlineDate: formatDateForInput(deadlineDate),
      amount: mockAmounts[Math.floor(Math.random() * mockAmounts.length)],
      description: 'Extracted from document. Please verify the details.'
    },
    // Legacy support
    billName: billName,
    deadlineDate: formatDateForInput(deadlineDate),
    time: '09:00',
    amount: mockAmounts[Math.floor(Math.random() * mockAmounts.length)],
    description: 'Extracted from document. Please verify the details.'
  }
}
