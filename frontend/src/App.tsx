import { useEffect, useState } from 'react'

interface HealthResponse {
  status: string
  database: string
}

function App() {

  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {

    let active = true

    async function checkBackend() {

      try {

        const response = await fetch('/api/v1/health/ready')

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.detail || 'Backend unavailable')
        }

        if (active) {
          setHealth(data)
          setError(null)
        }

      } catch (err) {

        if (active) {
          setError(
            err instanceof Error ? err.message : 'Connection failed'
          )
        }

      }
    }

    checkBackend()

    return () => {
      active = false
    }

  }, [])

  return (
    <main style={{ padding: '40px', fontFamily: 'Arial' }}>

      <h1>LedgerLine</h1>

      <h3>Secure Financial Transaction Platform</h3>

      <hr />

      <h2>System Status</h2>

      {health && (
        <div>
          <p>Backend: Connected</p>
          <p>Database: {health.database}</p>
          <p>Status: {health.status}</p>
        </div>
      )}

      {error && (
        <p style={{ color: 'red' }}>
          Connection Error: {error}
        </p>
      )}

    </main>
  )
}

export default App;