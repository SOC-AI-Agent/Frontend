import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import client from '../api/client'
import { endpoints } from '../api/endpoints'
import useAuthStore from '../stores/authStore'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await client.post(endpoints.auth.login, form)
      const { access_token, refresh_token } = res.data
      const meRes = await client.get(endpoints.auth.me, {
        headers: { Authorization: `Bearer ${access_token}` }
      })
      login(access_token, refresh_token, meRes.data)
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Login failed. Check your credentials.'
      const isDisabled = detail.toLowerCase().includes('inactive') ||
                         detail.toLowerCase().includes('disabled') ||
                         detail.toLowerCase().includes('active')

      await Swal.fire({
        icon: 'error',
        title: isDisabled ? 'Account Disabled' : 'Login Failed',
        text: detail,
        confirmButtonText: 'OK',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#38bdf8',
        customClass: {
          popup: 'swal-dark-popup',
        }
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="shield">🛡</span>
          <h1>SOC AI Suggestion</h1>
          <p>Security Operations AI Platform</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              placeholder="Enter username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoFocus required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <><span className="spinner" /> Signing in...</> : '→ Sign In'}
          </button>
        </form>

        <p className="text-muted" style={{ textAlign: 'center', marginTop: 20, fontSize: 11 }}>
          SOC AI Suggestion v1.3.1 · Powered by Ollama
        </p>
      </div>
    </div>
  )
}
