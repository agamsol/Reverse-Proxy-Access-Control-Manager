import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppearanceProvider, bootstrapAppearance } from './appearance-context'
import './index.css'
import App from './App.tsx'

bootstrapAppearance()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppearanceProvider>
      <App />
    </AppearanceProvider>
  </StrictMode>,
)
