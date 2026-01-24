/**
 * Text Extraction Service for extracting tasks and reminders from unstructured text
 * 
 * This service uses OpenAI's GPT API to extract tasks, intents, and entities
 * from unstructured text like emails, notes, or web articles.
 * 
 * Note: Uses the same OpenAI API key as document extraction
 */

import { getOpenAIClient } from './openaiClient'

export async function extractTasksFromText(text) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error('OpenAI API key not configured. Set VITE_OPENAI_API_KEY in .env and restart the dev server.')
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a task extraction assistant. Analyze the given text and extract actionable tasks, reminders, or commitments. 
          Identify:
          1. Intent/Task: What needs to be done (e.g., "Call John", "Pay bill", "Schedule meeting")
          2. Entities: People, places, or things mentioned
          3. Dates/Times: When the task should be done (extract relative dates like "Monday", "next week", "tomorrow" and convert to actual dates)
          4. Context: Any additional relevant information
          
          Today's date is ${new Date().toISOString().split('T')[0]}.
          Return ONLY valid JSON in this shape:
          { "tasks": [ { "title": "...", "date": "YYYY-MM-DD", "time": "HH:MM or null", "description": "...", "confidence": 0-1, "entities": [] } ] }`
        },
        {
          role: 'user',
          content: `Extract all tasks and reminders from this text:\n\n${text}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000
    })

    const content = response.choices?.[0]?.message?.content || ''
    
    // Try to parse JSON from the response
    try {
      const extracted = JSON.parse(content)
      const tasks = Array.isArray(extracted?.tasks) ? extracted.tasks : []
      
      // Validate and format the response
      return tasks.map(task => ({
        title: task.title || task.task || 'Untitled Task',
        date: task.date || formatDateForInput(new Date()),
        time: task.time || null,
        description: task.description || task.context || '',
        confidence: task.confidence || 0.8,
        entities: task.entities || [],
        sourceText: text.substring(0, 100) // Store snippet of source text
      }))
    } catch (parseError) {
      throw new Error('OpenAI response was not valid JSON. Please try again.')
    }
  } catch (error) {
    console.error('Text extraction error:', error)
    throw new Error(error.message || 'Failed to process text')
  }
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
