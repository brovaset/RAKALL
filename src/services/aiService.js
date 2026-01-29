/**
 * AI Service for extracting information from documents
 *
 * This service uses Groq to extract dates, amounts,
 * and other relevant information from uploaded documents.
 *
 * Note: You'll need to set up a Groq API key in your environment variables.
 * Create a .env file with: VITE_GROQ_API_KEY=your_api_key_here
 */

import { createGroqChatCompletion } from './groqClient'

export async function extractDocumentInfoFromText(text) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Groq API key not configured. Set VITE_GROQ_API_KEY in .env and restart the dev server.')
  }

  if (!text || text.trim().length < 20) {
    throw new Error('Document text is empty or unreadable. Try a text-based file or an image.')
  }

  try {
    const prompt = `Extract task details from this document text and return ONLY valid JSON.
Rules:
- Return a single JSON object only (no markdown, no extra text)
- Use YYYY-MM-DD for dates
- If you cannot find a value, set it to null (except billName which should be a short title)
- Prefer the actual due date over any reminder dates
- Do NOT guess or infer values that are not explicitly stated

JSON schema:
{
  "billName": "The task name or bill/service name",
  "deadlineDate": "The due date or deadline date in YYYY-MM-DD format",
  "time": "Time in HH:MM format if available, otherwise null",
  "amount": "Any monetary amount mentioned (e.g., '$150.00')",
  "description": "A brief description of the task or document"
}

IMPORTANT:
- Extract the actual deadline/due date from the document (not a reminder date)
- Look for terms like "Due Date", "Payment Due", "Deadline", "Pay By"
- If a date is not explicitly mentioned, try to infer it from context
- Today's date is ${new Date().toISOString().split('T')[0]}

Document text:
${text}`

    const content = await createGroqChatCompletion({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 500
    })
    const extracted = parseJsonFromText(content)
    const fallback = parseTextResponse(text)

    return normalizeDocumentInfo({
      billName: extracted.billName || extracted.title || fallback.billName || 'Document Reminder',
      deadlineDate: extracted.deadlineDate || extracted.date || fallback.deadlineDate || null,
      time: extracted.time || fallback.time || null,
      amount: extracted.amount || fallback.amount || null,
      description: extracted.description || fallback.description || ''
    })
  } catch (error) {
    console.error('AI text extraction error:', error)
    if (shouldUseMock(error)) {
      throw new Error(formatGroqError(error, 'Groq quota exceeded. Please try again later.'))
    }
    throw new Error(formatGroqError(error, 'Failed to process document text'))
  }
}

export async function extractDocumentInfo(base64Image, mimeType) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Groq API key not configured. Set VITE_GROQ_API_KEY in .env and restart the dev server.')
  }

  if (mimeType?.startsWith('image/')) {
    throw new Error('Groq does not support image input. Upload a PDF/DOCX or paste text instead.')
  }

  try {
    const prompt = `Analyze this document (bill, invoice, receipt, or any document) and extract the following information in JSON format.
Rules:
- Return a single JSON object only (no markdown, no extra text)
- Use YYYY-MM-DD for dates
- If you cannot find a value, set it to null (except billName which should be a short title)
- Prefer the actual due date over any reminder dates
- Do NOT guess or infer values that are not explicitly stated
- If multiple amounts exist, choose the total due amount
 - If the document does not include a due date or amount, return null for those fields

JSON schema:
              {
                "billName": "The task name or bill/service name (e.g., 'Pay Electricity Bill')",
                "deadlineDate": "The due date or deadline date in YYYY-MM-DD format (this is the actual deadline from the document)",
                "time": "Time in HH:MM format if available, otherwise null",
                "amount": "Any monetary amount mentioned (e.g., '$150.00')",
                "description": "A brief description of the task or document"
              }

              IMPORTANT:
              - Extract the actual deadline/due date from the document (not a reminder date)
              - Look for terms like "Due Date", "Payment Due", "Deadline", "Pay By"
              - If a date is not explicitly mentioned, try to infer it from context (e.g., "due in 30 days" from today's date)
              - Today's date is ${new Date().toISOString().split('T')[0]}
              - Return ONLY valid JSON`

    const content = await createGroqChatCompletion({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 500
    })
    const extracted = parseJsonFromText(content)

    return normalizeDocumentInfo({
      billName: extracted.billName || extracted.title || 'Document Reminder',
      deadlineDate: extracted.deadlineDate || extracted.date || null,
      time: extracted.time || null,
      amount: extracted.amount || null,
      description: extracted.description || ''
    })
  } catch (error) {
    console.error('AI extraction error:', error)
    if (shouldUseMock(error)) {
      throw new Error(formatGroqError(error, 'Groq quota exceeded. Please try again later.'))
    }
    throw new Error(formatGroqError(error, 'Failed to process document'))
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

function parseTextResponse(text) {
  // Fallback parser for when JSON parsing fails
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})/)
  const amountMatch = text.match(/\$?[\d,]+\.?\d{0,2}/)
  const billNameMatch = text.match(/(billName|title)["\s:]+([^"}\n]+)/i)
  
  return {
    billName: billNameMatch ? billNameMatch[2].trim() : 'Document Reminder',
    deadlineDate: dateMatch ? formatDate(dateMatch[0]) : formatDateForInput(new Date()),
    time: null,
    amount: amountMatch ? amountMatch[0] : null,
    description: text.substring(0, 200)
  }
}

function normalizeDocumentInfo(info) {
  return {
    billName: info.billName || 'Document Reminder',
    deadlineDate: normalizeDate(info.deadlineDate),
    time: normalizeTime(info.time),
    amount: normalizeAmount(info.amount),
    description: info.description || ''
  }
}

function normalizeDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  return null
}

function normalizeTime(value) {
  if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
    return value
  }
  return null
}

function normalizeAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const match = value.replace(/,/g, '').match(/(\d+(\.\d+)?)/)
    if (match) {
      return match[1]
    }
  }
  return null
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
  
  return {
    billName: mockBillNames[Math.floor(Math.random() * mockBillNames.length)],
    deadlineDate: formatDateForInput(deadlineDate),
    time: '09:00',
    amount: mockAmounts[Math.floor(Math.random() * mockAmounts.length)],
    description: 'Extracted from document. Please verify the details.'
  }
}
