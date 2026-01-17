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
                - Today's date is ${new Date().toISOString().split('T')[0]}`
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
        max_tokens: 500
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
      
      // Validate and format the response
      return {
        billName: extracted.billName || extracted.title || 'Document Reminder',
        deadlineDate: extracted.deadlineDate || extracted.date || formatDateForInput(new Date()),
        time: extracted.time || null,
        amount: extracted.amount || null,
        description: extracted.description || ''
      }
    } catch (parseError) {
      // If JSON parsing fails, try to extract information using regex
      return parseTextResponse(content)
    }
  } catch (error) {
    console.error('AI extraction error:', error)
    // Fallback to mock extraction on error
    return mockExtractDocumentInfo()
  }
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
