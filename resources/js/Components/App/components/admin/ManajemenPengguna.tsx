import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Shield, Search } from 'lucide-react';
import { toast } from 'sonner';
import { User, UserRole } from '../../data';
import { ConfirmDialog } from '../ConfirmDialog';

export function ManajemenPengguna() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nama: '',
    jabatan: '',
    role: 'admin' as UserRole,
  });

  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      setUsers(res.data || []);
    } catch {
      toast.error('Gagal memuat daftar akun petugas.');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '',
        nama: user.nama,
        jabatan: user.jabatan,
        role: 'admin',
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        nama: '',
        jabatan: 'Petugas Kelurahan',
        role: 'admin',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload = { ...formData, role: 'admin' };
        if (!payload.password) delete (payload as any).password;
        await axios.put(`/api/users/${editingUser.id}`, payload);
        toast.success('Data akun petugas berhasil diperbarui.');
      } else {
        await axios.post('/api/users', { ...formData, role: 'admin' });
        toast.success('Akun petugas baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data akun petugas.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await axios.delete(`/api/users/${confirmDelete.id}`);
      toast.success('Akun petugas berhasil dihapus.');
      fetchUsers();
    } catch {
      toast.error('Gagal menghapus akun petugas.');
    } finally {
      setConfirmDelete(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.jabatan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8 bg-white border-4 border-[#1E3A5F] text-center text-[#1E3A5F] font-bold">
        Memuat daftar akun petugas...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-white border-4 border-[#1E3A5F] overflow-hidden">
        <div className="p-5 border-b-2 border-[#1E3A5F] flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-[#FAFAFA]">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Cari nama petugas, username, atau jabatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] bg-white focus:outline-none"
            />
          </div>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] border-2 border-[#1E3A5F] text-white text-xs font-bold hover:bg-blue-900 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Akun Petugas
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#1E3A5F] text-white font-bold">
                <th className="p-3.5 border-r border-white/20">Nama Lengkap Petugas</th>
                <th className="p-3.5 border-r border-white/20">Username Login</th>
                <th className="p-3.5 border-r border-white/20">Jabatan</th>
                <th className="p-3.5 border-r border-white/20">Peran</th>
                <th className="p-3.5 text-center w-28">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-200">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-black text-[#1E3A5F] text-sm border-r border-slate-200">
                      {u.nama}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-blue-700 border-r border-slate-200">
                      {u.username}
                    </td>
                    <td className="p-3.5 font-medium text-[#475569] border-r border-slate-200">
                      {u.jabatan}
                    </td>
                    <td className="p-3.5 border-r border-slate-200">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-blue-100 text-[#1E3A5F] border border-[#1E3A5F]">
                        <Shield className="w-3.5 h-3.5" />
                        Admin Kelurahan
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openModal(u)}
                          className="p-1.5 text-[#1E3A5F] bg-white border-2 border-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white transition-colors"
                          title="Ubah"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u)}
                          className="p-1.5 text-rose-700 bg-white border-2 border-[#1E3A5F] hover:bg-rose-600 hover:text-white transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center font-bold text-[#64748B]">
                    Tidak ada akun petugas yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit Petugas */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border-4 border-[#1E3A5F] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b-2 border-[#1E3A5F] bg-[#FAFAFA]">
              <h3 className="font-black text-[#1E3A5F] text-base">
                {editingUser ? 'Ubah Data Akun Petugas' : 'Tambah Akun Petugas Baru'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#1E3A5F] mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-[#1E3A5F] font-bold text-[#1E3A5F]"
                  placeholder="Contoh: Budi Santoso"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1E3A5F] mb-1">Username Login</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-[#1E3A5F] font-mono font-bold text-[#1E3A5F]"
                  placeholder="Contoh: petugas1"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1E3A5F] mb-1">
                  Kata Sandi {editingUser && '(Kosongkan jika tidak diubah)'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-[#1E3A5F] font-bold text-[#1E3A5F]"
                  placeholder="Minimal 6 karakter"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1E3A5F] mb-1">Jabatan</label>
                <input
                  type="text"
                  required
                  value={formData.jabatan}
                  onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-[#1E3A5F] font-bold text-[#1E3A5F]"
                  placeholder="Contoh: Operator Bansos Kelurahan"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border-2 border-[#1E3A5F] font-bold text-[#1E3A5F]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1E3A5F] text-white border-2 border-[#1E3A5F] font-bold hover:bg-blue-900"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Hapus Akun Petugas"
        message={`Apakah Anda yakin ingin menghapus akun petugas "${confirmDelete?.nama}"?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
