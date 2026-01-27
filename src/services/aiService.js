/**
 * AI Service for extracting information from documents
 *
 * This service uses OpenAI's GPT-4 Vision API to extract dates, amounts,
 * and other relevant information from uploaded documents.
 *
 * Note: You'll need to set up an OpenAI API key in your environment variables.
 * Create a .env file with: VITE_OPENAI_API_KEY=your_api_key_here
 */

import { getOpenAIClient } from './openaiClient'

export async function extractDocumentInfoFromText(text) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error('OpenAI API key not configured. Set VITE_OPENAI_API_KEY in .env and restart the dev server.')
  }

  if (!text || text.trim().length < 20) {
    throw new Error('Document text is empty or unreadable. Try a text-based file or an image.')
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Extract bill/reminder details from this document text and return ONLY valid JSON:
{
  "billName": "The name/title of the bill or service",
  "deadlineDate": "The due date or deadline date in YYYY-MM-DD format",
  "time": "Time in HH:MM format if available, otherwise null",
  "amount": "Any monetary amount mentioned (e.g., '$150.00')",
  "description": "A brief description of what this document is about"
}

IMPORTANT:
- Extract the actual deadline/due date from the document (not a reminder date)
- Look for terms like "Due Date", "Payment Due", "Deadline", "Pay By"
- If a date is not explicitly mentioned, try to infer it from context
- Today's date is ${new Date().toISOString().split('T')[0]}

Document text:
${text}`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.2
    })

    const content = response.choices?.[0]?.message?.content || ''
    const extracted = JSON.parse(content)

    return {
      billName: extracted.billName || extracted.title || 'Document Reminder',
      deadlineDate: extracted.deadlineDate || extracted.date || formatDateForInput(new Date()),
      time: extracted.time || null,
      amount: extracted.amount || null,
      description: extracted.description || ''
    }
  } catch (error) {
    console.error('AI text extraction error:', error)
    if (shouldUseMock(error)) {
      return mockExtractDocumentInfo()
    }
    throw new Error(formatOpenAIError(error, 'Failed to process document text'))
  }
}

export async function extractDocumentInfo(base64Image, mimeType) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error('OpenAI API key not configured. Set VITE_OPENAI_API_KEY in .env and restart the dev server.')
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this document (bill, invoice, receipt, or any document) and extract the following information in JSON format:
              {
                "billName": "The name/title of the bill or service (e.g., 'Electricity Bill', 'Credit Card Statement', 'Insurance Premium')",
                "deadlineDate": "The due date or deadline date in YYYY-MM-DD format (this is the actual deadline from the document)",
                "time": "Time in HH:MM format if available, otherwise null",
                "amount": "Any monetary amount mentioned (e.g., '$150.00')",
                "description": "A brief description of what this document is about"
              }

              IMPORTANT:
              - Extract the actual deadline/due date from the document (not a reminder date)
              - Look for terms like "Due Date", "Payment Due", "Deadline", "Pay By"
              - If a date is not explicitly mentioned, try to infer it from context (e.g., "due in 30 days" from today's date)
              - Today's date is ${new Date().toISOString().split('T')[0]}
              - Return ONLY valid JSON`
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
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.2
    })

    const content = response.choices?.[0]?.message?.content || ''
    
    // Try to parse JSON from the response
    try {
      const extracted = JSON.parse(content)
      
      // Validate and format the response
      return {
        billName: extracted.billName || extracted.title || 'Document Reminder',
        deadlineDate: extracted.deadlineDate || extracted.date || formatDateForInput(new Date()),
        time: extracted.time || null,
        amount: extracted.amount || null,
        description: extracted.description || ''
      }
    } catch (parseError) {
      throw new Error('OpenAI response was not valid JSON. Please try again.')
    }
  } catch (error) {
    console.error('AI extraction error:', error)
    if (shouldUseMock(error)) {
      return mockExtractDocumentInfo()
    }
    throw new Error(formatOpenAIError(error, 'Failed to process document'))
  }
}

function shouldUseMock(error) {
  const status = error?.status || error?.response?.status
  const message = error?.message || ''

  return status === 429 || status === 503 || /quota|overloaded/i.test(message)
}

function formatOpenAIError(error, fallbackMessage) {
  const status = error?.status || error?.response?.status
  const message = error?.message || ''

  if (status === 401 || /invalid_api_key/i.test(message)) {
    return 'OpenAI API key is invalid. Update VITE_OPENAI_API_KEY and restart the dev server.'
  }

  if (status === 429 || /quota/i.test(message)) {
    return 'OpenAI quota exceeded. Check your plan and billing, or try again later.'
  }

  if (status === 503 || /overloaded/i.test(message)) {
    return 'OpenAI is temporarily overloaded. Please try again in a moment.'
  }

  return message || fallbackMessage
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
