import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@tabler/core/dist/css/tabler.min.css'
import './theme.css'
import './styles.css'
import './simUI.css'
import './siteBackground.css'
import './worldMapBackground.css'
import './menuArtwork.css'
import './visualHierarchy.css'
import './templateBridge.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
