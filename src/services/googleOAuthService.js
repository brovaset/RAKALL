let scriptLoadingPromise = null

export function loadGoogleOAuthScript() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve()
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise
  }

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google OAuth client script.'))
    document.head.appendChild(script)
  })

  return scriptLoadingPromise
}

export function getOAuthClientId() {
  return import.meta.env.VITE_OAUTH_CLIENT_ID || ''
}

export async function requestGoogleAccessToken({ scope }) {
  const clientId = getOAuthClientId()
  if (!clientId) {
    throw new Error('Google OAuth Client ID not configured. Set VITE_OAUTH_CLIENT_ID in .env and restart the dev server.')
  }

  await loadGoogleOAuthScript()

  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: (response) => {
        if (response?.error) {
          reject(new Error(response.error))
          return
        }
        resolve(response)
      }
    })

    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

export async function fetchGoogleUserProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch Google profile.')
  }

  return response.json()
}
