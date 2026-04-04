import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { PhaseFlagProvider } from './hooks/usePhaseFlagContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <PhaseFlagProvider>
                <App />
            </PhaseFlagProvider>
        </BrowserRouter>
    </React.StrictMode>
)
