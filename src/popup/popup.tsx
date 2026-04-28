import React from 'react'
import { createRoot } from 'react-dom/client'
import PopupApp from './PopupApp'
import '../styles/design-system.css'
import './popup.css'

createRoot(document.getElementById('root')!).render(<PopupApp />)
