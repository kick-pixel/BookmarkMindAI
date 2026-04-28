import React from 'react'
import { createRoot } from 'react-dom/client'
import SidePanelApp from './SidePanelApp'
import '../styles/design-system.css'
import './sidepanel.css'

createRoot(document.getElementById('root')!).render(<SidePanelApp />)
