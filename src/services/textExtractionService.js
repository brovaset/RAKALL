/**
 * Text Extraction Service for extracting tasks and reminders from unstructured text
 * 
 * This service uses Groq to extract tasks, intents, and entities
 * from unstructured text like emails, notes, or web articles.
 * 
 * Note: Uses the same Groq API key as document extraction
 */

import { createGroqChatCompletion } from './groqClient'

export async function extractTasksFromText(text) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Groq API key not configured. Set VITE_GROQ_API_KEY in .env and restart the dev server.')
  }

  try {
    const prompt = `You are a task extraction assistant. Extract actionable tasks, reminders, or commitments.
Rules:
- Return ONLY JSON (no markdown, no extra text)
- Output schema: { "tasks": [ ... ] }
- Each task must have: taskName, task, date (YYYY-MM-DD), time (HH:MM or null), price (number or null)
- Resolve relative dates like "tomorrow", "next week", "Monday" using today's date
- If a date is missing, set it to today's date
- If time is missing, set it to null
- If price/amount is missing, set it to null

Today's date is ${new Date().toISOString().split('T')[0]}.

Examples:
Input: "I should call John tomorrow at 2 PM about the project."
Output: {"tasks":[{"taskName":"Call John","task":"Call John about the project","date":"${new Date(Date.now() + 86400000).toISOString().split('T')[0]}","time":"14:00","price":null}]}

Input: "Pay the electricity bill next week."
Output: {"tasks":[{"taskName":"Pay electricity bill","task":"Pay the electricity bill","date":"${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}","time":null,"price":null}]}

Input: "Pay rent of $1200 on Feb 1."
Output: {"tasks":[{"taskName":"Pay rent","task":"Pay rent","date":"2025-02-01","time":null,"price":1200}]}

Extract all tasks and reminders from this text:
${text}`

    const content = await createGroqChatCompletion({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000
    })
    
    // Try to parse JSON from the response
    try {
      const extracted = parseJsonFromText(content)
      const rawTasks = Array.isArray(extracted)
        ? extracted
        : Array.isArray(extracted?.tasks)
          ? extracted.tasks
          : Array.isArray(extracted?.reminders)
            ? extracted.reminders
            : []
      
      // Validate and format the response
      return rawTasks.map(task => {
        const price = normalizePrice(task.price ?? task.amount ?? task.cost)
        const taskName = task.taskName || task.title || task.task || 'Untitled Task'
        const taskText = task.task || task.description || task.context || taskName
        const priceLabel = typeof price === 'number' ? `Price: $${price}` : null
        const description = [taskText, priceLabel].filter(Boolean).join(' • ')

        return {
          title: taskName,
          date: normalizeDate(task.date),
          time: normalizeTime(task.time),
          description,
          confidence: typeof task.confidence === 'number' ? task.confidence : 0.8,
          entities: Array.isArray(task.entities) ? task.entities : [],
          sourceText: text.substring(0, 100),
          price
        }
      })
    } catch (parseError) {
      throw new Error('Groq response was not valid JSON. Please try again.')
    }
  } catch (error) {
    console.error('Text extraction error:', error)
    if (shouldUseMock(error)) {
      throw new Error(formatGroqError(error, 'Groq quota exceeded. Please try again later.'))
    }
    throw new Error(formatGroqError(error, 'Failed to process text'))
  }
}

function shouldUseMock(error) {
  if (!isMockEnabled()) {
    return false
  }
  const status = error?.status || error?.response?.status
  const message = error?.message || ''

  return status === 429 || status === 503 || /quota|overloaded|resource_exhausted|rate/i.test(message)
}

function formatGroqError(error, fallbackMessage) {
  const status = error?.status || error?.response?.status
  const message = error?.message || ''

  if (status === 401 || /invalid_api_key/i.test(message)) {
    return 'Groq API key is invalid. Update VITE_GROQ_API_KEY and restart the dev server.'
  }

  if (status === 429 || /quota|resource_exhausted|rate|rate_limit/i.test(message)) {
    return 'Groq quota exceeded. Check your plan and billing, or try again later.'
  }

  if (status === 503 || /overloaded/i.test(message)) {
    return 'Groq is temporarily overloaded. Please try again in a moment.'
  }

  return message || fallbackMessage
}

function isMockEnabled() {
  return import.meta.env.VITE_ALLOW_MOCK_AI === 'true'
}

function parseJsonFromText(content) {
  if (!content) {
    throw new Error('Groq response was empty. Please try again.')
  }

  const jsonBlockMatch = content.match(/```json\\s*([\\s\\S]*?)\\s*```/i)
    || content.match(/```\\s*([\\s\\S]*?)\\s*```/i)
  const raw = jsonBlockMatch ? jsonBlockMatch[1] : content

  const jsonStart = raw.indexOf('{')
  const jsonEnd = raw.lastIndexOf('}')
  const jsonString = jsonStart >= 0 && jsonEnd >= 0 ? raw.slice(jsonStart, jsonEnd + 1) : raw

  return JSON.parse(jsonString)
}

function parseTextForTasks(text) {
  // Fallback parser for when JSON parsing fails
  const tasks = []
  
  // Look for common patterns
  const datePatterns = [
    /(?:on|by|before|after)\s+(\w+day)/i,
    /(?:on|by|before|after)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(?:on|by|before|after)\s+(\w+\s+\d{1,2})/i,
    /(?:tomorrow|today|next week|next month)/i
  ]
  
  const timePatterns = [
    /(?:at|by)\s+(\d{1,2}:\d{2})/i,
    /(?:at|by)\s+(\d{1,2})\s*(?:am|pm)/i
  ]
  
  // Split text into sentences and look for action verbs
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
  
  sentences.forEach(sentence => {
    const trimmed = sentence.trim()
    if (trimmed.length < 10) return
    
    // Look for action verbs
    const actionPatterns = [
      /(?:need to|should|must|have to|will|going to)\s+([^.!?]+)/i,
      /(?:call|email|meet|pay|schedule|book|buy|send|complete|finish)\s+([^.!?]+)/i
    ]
    
    let taskTitle = null
    for (const pattern of actionPatterns) {
      const match = trimmed.match(pattern)
      if (match) {
        taskTitle = match[0].trim()
        break
      }
    }
    
    if (taskTitle) {
      // Extract date
      let date = formatDateForInput(new Date())
      for (const pattern of datePatterns) {
        const match = trimmed.match(pattern)
        if (match) {
          date = parseRelativeDate(match[1])
          break
        }
      }
      
      // Extract time
      let time = null
      for (const pattern of timePatterns) {
        const match = trimmed.match(pattern)
        if (match) {
          time = parseTime(match[1])
          break
        }
      }
      
      tasks.push({
        title: taskTitle.substring(0, 100),
        date: date,
        time: time,
        description: trimmed.substring(0, 200),
        confidence: 0.6,
        entities: [],
        sourceText: trimmed.substring(0, 100)
      })
    }
  })
  
  return tasks.length > 0 ? tasks : mockExtractTasksFromText()
}

function normalizeDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  return formatDateForInput(new Date())
}

function normalizeTime(value) {
  if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
    return value
  }
  return null
}

function normalizePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const match = value.replace(/,/g, '').match(/(\d+(\.\d+)?)/)
    if (match) {
      return Number(match[1])
    }
  }
  return null
}

function parseRelativeDate(dateString) {
  const today = new Date()
  const lower = dateString.toLowerCase()
  
  if (lower.includes('tomorrow')) {
    today.setDate(today.getDate() + 1)
  } else if (lower.includes('next week')) {
    today.setDate(today.getDate() + 7)
  } else if (lower.includes('next month')) {
    today.setMonth(today.getMonth() + 1)
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
