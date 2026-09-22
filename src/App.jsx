import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login     from './pages/Login'
import Dashboard from './pages/Dashboard'
import Jobs      from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import JobEvidence from './pages/JobEvidence'
import ApiKeys   from './pages/ApiKeys'
import Users     from './pages/Users'
import AuditLogs from './pages/AuditLogs'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
        <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
        <Route path="/jobs/:id/evidence" element={<ProtectedRoute><JobEvidence /></ProtectedRoute>} />
        <Route path="/api-keys" element={<ProtectedRoute><ApiKeys /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute role="admin"><Users /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute role="admin"><AuditLogs /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
