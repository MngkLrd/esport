import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './theme.css'
import './styles.css'
import './simUI.css'
import './siteBackground.css'
import './worldMapBackground.css'
import './menuArtwork.css'
import './visualHierarchy.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
