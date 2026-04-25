import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Homepage from './homepage'
import { Component as LoginPage } from './login'
import { Component as AnalyticsPage } from './analytics'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
