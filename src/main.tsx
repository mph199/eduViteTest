import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrandingProvider } from './contexts/BrandingContext'
import { TextBrandingProvider } from './contexts/TextBrandingContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrandingProvider>
      <TextBrandingProvider>
        <App />
      </TextBrandingProvider>
    </BrandingProvider>
  </StrictMode>,
)
