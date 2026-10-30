import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'admin-lte/dist/css/adminlte.min.css'
import './index.css'
import './light-mode.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
