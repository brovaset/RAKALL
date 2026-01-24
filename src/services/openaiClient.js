import OpenAI from 'openai'

let cachedClient = null

export function getOpenAIClient() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  return cachedClient
}
