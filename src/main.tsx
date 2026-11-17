import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Mise à jour automatique : dès qu'une nouvelle version est publiée, l'appli la prend
// et se recharge. On vérifie aussi à chaque retour dans l'appli, car sur iPhone
// une appli installée reste souvent ouverte longtemps en arrière-plan.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const verifier = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', verifier)
    setInterval(verifier, 60 * 60 * 1000)
  },
})
