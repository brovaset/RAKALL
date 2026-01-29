export async function createGroqChatCompletion({
  model,
  messages,
  temperature = 0.2,
  max_tokens = 500
}) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error('Groq API key not configured. Set VITE_GROQ_API_KEY in .env and restart the dev server.')
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens
    })
  })

  if (!response.ok) {
    let errorMessage = 'Groq request failed.'
    try {
      const errorBody = await response.json()
      errorMessage = errorBody?.error?.message || errorMessage
    } catch (error) {
      // ignore parsing errors
    }
    const err = new Error(errorMessage)
    err.status = response.status
    throw err
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ''
}
