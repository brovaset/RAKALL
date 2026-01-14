/**
 * Text Extraction Service for extracting tasks and reminders from unstructured text
 * 
 * This service uses OpenAI's GPT API to extract tasks, intents, and entities
 * from unstructured text like emails, notes, or web articles.
 * 
 * Note: Uses the same OpenAI API key as document extraction
 */

export async function extractTasksFromText(text) {
  // Check if OpenAI API key is configured
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  
  if (!apiKey) {
    // Fallback to mock extraction if no API key
    console.warn('OpenAI API key not found. Using mock extraction.')
    return mockExtractTasksFromText()
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a precise task extraction AI. Extract ONLY tasks, reminders, and deadlines that are EXPLICITLY mentioned in the text. DO NOT invent, assume, or add tasks that are not in the input.

CRITICAL RULES:
1. Extract ONLY what is explicitly stated in the text
2. DO NOT add tasks that are not mentioned
3. DO NOT infer tasks from context unless explicitly stated
4. If the text says "pay gas bill by 12/12/2026", extract exactly that - nothing more
5. Convert dates to YYYY-MM-DD format
6. Extract times in HH:MM format (24-hour) if mentioned
7. Return ONLY valid JSON array - if no tasks found, return empty array []

Today's date: ${new Date().toISOString().split('T')[0]}

EXTRACTION RULES:
- Look for explicit action verbs: pay, call, meet, schedule, submit, etc.
- Extract dates: "12/12/2026" → "2026-12-12", "by December 12, 2026" → "2026-12-12"
- Extract times only if explicitly mentioned: "at 2 PM" → "14:00"
- Task types: bill, meeting, deadline, appointment, task, reminder
- Extract amounts only if mentioned in the text
- Use the exact wording from the text for titles when possible

DATE FORMATS TO HANDLE:
- MM/DD/YYYY or M/D/YYYY: "12/12/2026" → "2026-12-12"
- YYYY-MM-DD: already correct format
- Month name: "December 12, 2026" → "2026-12-12"
- Relative: "tomorrow" = ${formatDateForInput(new Date(Date.now() + 86400000))}, "next Monday" = calculate actual date

RETURN FORMAT (JSON array only):
[
  {
    "title": "Exact task from text",
    "date": "YYYY-MM-DD",
    "time": "HH:MM or null",
    "description": "Context from text",
    "confidence": 0.0-1.0,
    "type": "bill|meeting|deadline|appointment|task|reminder",
    "amount": "string or null",
    "entities": []
  }
]

EXAMPLES:
Input: "conedison. pay gas bill by 12/12/2026"
Output: [
  {
    "title": "Pay gas bill",
    "date": "2026-12-12",
    "time": null,
    "description": "ConEdison gas bill",
    "confidence": 0.95,
    "type": "bill",
    "amount": null,
    "entities": []
  }
]

Input: "Call John tomorrow at 2 PM"
Output: [
  {
    "title": "Call John",
    "date": "${formatDateForInput(new Date(Date.now() + 86400000))}",
    "time": "14:00",
    "description": "",
    "confidence": 0.9,
    "type": "task",
    "amount": null,
    "entities": ["John"]
  }
]

IMPORTANT: Extract ONLY what is in the text. Do not add extra tasks. If text is unclear, return empty array.`
          },
          {
            role: 'user',
            content: `Extract ONLY the tasks, reminders, and deadlines that are EXPLICITLY mentioned in this text. Do not add or infer any tasks that are not stated:\n\n"${text}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to process text')
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    
    // Try to parse JSON from the response
    try {
      // Extract JSON from markdown code blocks if present
      let jsonString = content
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonString = jsonMatch[1]
      } else {
        // Try to find JSON array or object in the text
        const jsonArrayMatch = content.match(/\[[\s\S]*\]/)
        const jsonObjectMatch = content.match(/\{[\s\S]*\}/)
        if (jsonArrayMatch) {
          jsonString = jsonArrayMatch[0]
        } else if (jsonObjectMatch) {
          jsonString = jsonObjectMatch[0]
        }
      }
      
      const extracted = JSON.parse(jsonString)
      
      // Handle both array and object formats
      let tasks = []
      if (Array.isArray(extracted)) {
        tasks = extracted
      } else if (extracted && typeof extracted === 'object') {
        if (extracted.tasks && Array.isArray(extracted.tasks)) {
          tasks = extracted.tasks
        } else if (extracted.title || extracted.task) {
          tasks = [extracted]
        }
      }
      
      // Validate and format the response
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      return tasks.map(task => {
        const title = (task.title || task.task || 'Untitled Task').trim()
        const date = validateAndFormatDate(task.date || task.deadlineDate || task.dueDate)
        const dateObj = new Date(date)
        dateObj.setHours(0, 0, 0, 0)
        
        const time = validateAndFormatTime(task.time)
        const description = (task.description || task.context || '').trim()
        let confidence = Math.min(Math.max(task.confidence || 0.7, 0), 1)
        
        // Adjust confidence for past dates
        if (dateObj < today && confidence > 0.8) {
          confidence = Math.max(confidence - 0.2, 0.5)
        }
        
        const type = task.type || inferTaskType(title)
        const amount = task.amount ? formatAmount(task.amount) : null
        
        return {
          title,
          date,
          time,
          description,
          confidence,
          type,
          amount,
          entities: task.entities || [],
          sourceText: text.substring(0, 100) // Store snippet of source text
        }
      }).filter(task => {
        // Remove invalid tasks
        if (!task.title || task.title === 'Untitled Task') return false
        if (!task.date) return false
        return true
      })
    } catch (parseError) {
      // If JSON parsing fails, try to extract information using regex
      console.warn('JSON parsing failed, attempting fallback parser:', parseError.message)
      console.log('Response content:', content.substring(0, 500))
      return parseTextForTasks(text)
    }
    } catch (error) {
    console.error('Text extraction error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    })
    // Try fallback parser instead of mock data
    try {
      return parseTextForTasks(text)
    } catch (fallbackError) {
      console.error('Fallback parser also failed:', fallbackError)
      // Return empty array instead of mock data
      return []
    }
  }
}

function parseTextForTasks(text) {
  // Enhanced fallback parser for when JSON parsing fails
  console.warn('JSON parsing failed, using enhanced fallback parser')
  const tasks = []
  
  // Enhanced date patterns - prioritize explicit dates
  const datePatterns = [
    { pattern: /(?:by|before|after|due|on)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i, type: 'absolute' }, // MM/DD/YYYY
    { pattern: /(?:by|before|after|due|on)\s+(\d{4}-\d{2}-\d{2})/i, type: 'absolute' }, // YYYY-MM-DD
    { pattern: /(\d{1,2}\/\d{1,2}\/\d{4})/, type: 'absolute' }, // Standalone date MM/DD/YYYY
    { pattern: /(?:by|before|after|due|on)\s+(\w+day)/i, type: 'relative' },
    { pattern: /(?:by|before|after|due|on)\s+(\w+\s+\d{1,2},?\s+\d{4})/i, type: 'absolute' },
    { pattern: /(tomorrow|today|next week|next month|in \d+ days?)/i, type: 'relative' }
  ]
  
  // Enhanced time patterns
  const timePatterns = [
    /(?:at|by|@)\s+(\d{1,2}:\d{2})\s*(?:am|pm)?/i,
    /(?:at|by|@)\s+(\d{1,2})\s*(?:am|pm)/i,
    /(\d{1,2}:\d{2})\s*(?:am|pm)/i
  ]
  
  // More precise action patterns - look for explicit actions
  const actionPatterns = [
    /(pay|call|email|meet|schedule|book|buy|send|complete|finish|submit|attend|review|prepare)\s+([^.!?]+?)(?:\s+by|\s+before|\s+due|$)/i
  ]
  
  // Process the entire text
  const trimmed = text.trim()
  
  // First, try to find a date
  let extractedDate = null
  for (const datePattern of datePatterns) {
    const match = trimmed.match(datePattern.pattern)
    if (match) {
      if (datePattern.type === 'absolute') {
        extractedDate = validateAndFormatDate(match[1])
      } else {
        extractedDate = parseRelativeDate(match[1])
      }
      break
    }
  }
  
  // If no date found, don't create a task
  if (!extractedDate) {
    return []
  }
  
  // Look for action verbs
  let taskTitle = null
  let actionVerb = null
  
  for (const pattern of actionPatterns) {
    const match = trimmed.match(pattern)
    if (match) {
      actionVerb = match[1].toLowerCase()
      // Get the object of the action (what comes after the verb)
      const afterVerb = match[2] ? match[2].trim() : ''
      // Clean up - remove date references
      const cleaned = afterVerb.replace(/\s+by\s+[\d\/]+.*$/i, '').trim()
      taskTitle = `${match[1]} ${cleaned}`.trim()
      break
    }
  }
  
  // If no action found, try simpler pattern
  if (!taskTitle) {
    const simplePattern = /(pay|call|meet|schedule|submit)\s+([^.!?]+)/i
    const match = trimmed.match(simplePattern)
    if (match) {
      const afterAction = match[2].replace(/\s+by\s+[\d\/]+.*$/i, '').trim()
      taskTitle = `${match[1]} ${afterAction}`.trim()
    }
  }
  
  // If still no title, try to infer from context (handle "conedison. pay gas bill by 12/12/2026")
  if (!taskTitle && extractedDate) {
    // Pattern: "company. pay bill by date" or "pay bill by date"
    const companyBillMatch = trimmed.match(/([a-z]+)\s*\.\s*pay\s+([^.!?]+?)(?:\s+by|\s+on|$)/i)
    if (companyBillMatch) {
      const company = companyBillMatch[1]
      const billType = companyBillMatch[2].trim()
      taskTitle = `Pay ${company} ${billType}`.trim()
    } else {
      // Pattern: "pay [something] bill by date"
      const billMatch = trimmed.match(/pay\s+([^.!?]+?)(?:\s+by|\s+on|$)/i)
      if (billMatch) {
        taskTitle = `Pay ${billMatch[1].trim()}`
      } else {
        // Look for any company/service name
        const companyMatch = trimmed.match(/([a-z]+)\s*\.?\s*(?:pay|bill)/i)
        if (companyMatch) {
          taskTitle = `Pay ${companyMatch[1]} bill`
        } else {
          // Only use generic if we really can't infer
          return []
        }
      }
    }
  }
  
  if (taskTitle && extractedDate) {
    // Extract time
    let time = null
    for (const pattern of timePatterns) {
      const match = trimmed.match(pattern)
      if (match) {
        time = validateAndFormatTime(match[1])
        if (time) break
      }
    }
    
    // Infer task type
    const type = inferTaskType(taskTitle)
    
    tasks.push({
      title: taskTitle.substring(0, 100),
      date: extractedDate,
      time: time,
      description: trimmed.substring(0, 200),
      confidence: 0.85,
      type: type,
      amount: null,
      entities: [],
      sourceText: trimmed.substring(0, 100)
    })
  }
  
  // Only return tasks if we found some - don't use mock data
  return tasks
}

function parseRelativeDate(dateString) {
  const today = new Date()
  const lower = dateString.toLowerCase()
  
  if (lower.includes('tomorrow')) {
    today.setDate(today.getDate() + 1)
  } else if (lower.includes('today')) {
    // Keep today's date
  } else if (lower.includes('next week')) {
    today.setDate(today.getDate() + 7)
  } else if (lower.includes('next month')) {
    today.setMonth(today.getMonth() + 1)
  } else if (lower.match(/in\s+(\d+)\s+days?/)) {
    const daysMatch = lower.match(/in\s+(\d+)\s+days?/)
    if (daysMatch) {
      today.setDate(today.getDate() + parseInt(daysMatch[1]))
    }
  } else if (lower.includes('monday')) {
    const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7
    today.setDate(today.getDate() + daysUntilMonday)
  } else if (lower.includes('tuesday')) {
    const daysUntilTuesday = (2 - today.getDay() + 7) % 7 || 7
    today.setDate(today.getDate() + daysUntilTuesday)
  } else if (lower.includes('wednesday')) {
    const daysUntilWednesday = (3 - today.getDay() + 7) % 7 || 7
    today.setDate(today.getDate() + daysUntilWednesday)
  } else if (lower.includes('thursday')) {
    const daysUntilThursday = (4 - today.getDay() + 7) % 7 || 7
    today.setDate(today.getDate() + daysUntilThursday)
  } else if (lower.includes('friday')) {
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7
    today.setDate(today.getDate() + daysUntilFriday)
  } else if (lower.includes('saturday')) {
    const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
    today.setDate(today.getDate() + daysUntilSaturday)
  } else if (lower.includes('sunday')) {
    const daysUntilSunday = (7 - today.getDay() + 7) % 7 || 7
    today.setDate(today.getDate() + daysUntilSunday)
  }
  
  return formatDateForInput(today)
}

function parseTime(timeString) {
  // Simple time parsing
  const match = timeString.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i)
  if (match) {
    let hours = parseInt(match[1])
    const minutes = match[2] ? parseInt(match[2]) : 0
    const period = match[3]?.toLowerCase()
    
    if (period === 'pm' && hours !== 12) hours += 12
    if (period === 'am' && hours === 12) hours = 0
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }
  return null
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
  ]
  
  for (const format of formats) {
    const match = dateString.match(format)
    if (match) {
      if (format === formats[0]) {
        return dateString.substring(0, 10) // Already YYYY-MM-DD
      } else {
        const month = match[1].padStart(2, '0')
        const day = match[2].padStart(2, '0')
        const year = match[3]
        return `${year}-${month}-${day}`
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

function mockExtractTasksFromText() {
  // Mock extraction for testing without API key
  const mockTasks = [
    {
      title: 'Call John about the project',
      date: formatDateForInput(new Date(Date.now() + 86400000)), // Tomorrow
      time: '14:00',
      description: 'Follow up on project status',
      confidence: 0.85,
      entities: ['John'],
      sourceText: 'I should call John tomorrow at 2 PM'
    },
    {
      title: 'Pay electricity bill',
      date: formatDateForInput(new Date(Date.now() + 7 * 86400000)), // Next week
      time: null,
      description: 'Due next week',
      confidence: 0.9,
      entities: [],
      sourceText: 'Electricity bill due next week'
    }
  ]
  
  return mockTasks
}
