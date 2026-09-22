import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Pagination from '../components/Pagination'
import ConfirmModal from '../components/ConfirmModal'
import client from '../api/client'
import { endpoints } from '../api/endpoints'

const ROLES = ['admin', 'analyst', 'readonly']

export default function Users() {
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'analyst' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Pagination
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(20)

  // Confirm Delete
  const [userToDelete, setUserToDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = async () => {
    const res = await client.get(endpoints.users.list)
    setUsers(res.data)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditUser(null); setForm({ username: '', email: '', password: '', role: 'analyst' }); setError(''); setShowModal(true) }
  const openEdit   = (u) => { setEditUser(u);   setForm({ username: u.username, email: u.email, password: '', role: u.role }); setError(''); setShowModal(true) }

  const save = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      if (editUser) {
        const body = { role: form.role, email: form.email }
        if (form.password) body.password = form.password
        await client.put(endpoints.users.byId(editUser.id), body)
      } else {
        await client.post(endpoints.users.list, form)
      }
      setShowModal(false)
      await load()
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : 'Error saving user'))
    } finally { setLoading(false) }
  }

  const toggleActive = async (u) => {
    await client.put(endpoints.users.byId(u.id), { is_active: !u.is_active })
    await load()
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await client.delete(endpoints.users.byId(userToDelete.id))
      setUserToDelete(null)
      await load()
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Delete failed: Internal Server Error')
    } finally { setDeleteLoading(false) }
  }

  // Slice users for local pagination (since /admin/users doesn't support server-side pagination yet)
  const paginatedUsers = users.slice(page * limit, (page + 1) * limit)

  return (
    <Layout title="Users">
      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-sub">{users.length} users total</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New User</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {paginatedUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td className="text-muted">{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-failed' : u.role === 'analyst' ? 'badge-processing' : 'badge-pending'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-completed' : 'badge-failed'}`}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
                         {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => setUserToDelete(u)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="empty-state">No users found</div>}
        </div>

        <Pagination 
          total={users.length}
          limit={limit}
          page={page}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(0); }}
        />
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editUser ? `Edit: ${editUser.username}` : 'Create User'}</div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={save}>
              {!editUser && (
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="form-input" required value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Password {editUser && '(leave empty to keep)'}</label>
                <input className="form-input" type="password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <span className="spinner" /> : (editUser ? 'Save Changes' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!userToDelete}
        title="Delete User"
        message={`Are you sure you want to permanently delete user "${userToDelete?.username}"? This action cannot be undone.`}
        loading={deleteLoading}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setUserToDelete(null); setDeleteError(''); }}
      />
    </Layout>
  )
}
