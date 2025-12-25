import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App.jsx'
import './App.css'

// ✅ Service Worker ONLY in production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
