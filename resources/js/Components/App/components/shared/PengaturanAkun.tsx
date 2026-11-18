import { useState } from 'react';
import { Eye, EyeOff, Save, User, Lock, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { User as UserType } from '../../data';
import axios from 'axios';

interface Props {
  user: UserType;
}

export function PengaturanAkun({ user }: Props) {
  const [nama, setNama] = useState(user.nama);
  const [jabatan, setJabatan] = useState(user.jabatan);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const saveProfile = async () => {
    if (!nama.trim()) {
      toast.error('Nama lengkap tidak boleh kosong.');
      return;
    }
    try {
      await axios.put(`/api/users/${user.id}`, { nama, jabatan });
      toast.success('Profil berhasil diperbarui.');
    } catch {
      toast.error('Gagal memperbarui profil.');
    }
  };

  const savePassword = async () => {
    if (newPass.length < 6) {
      toast.error('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (newPass !== confirmPass) {
      toast.error('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    try {
      await axios.put(`/api/users/${user.id}`, { password: newPass });
      toast.success('Kata sandi berhasil diubah.');
      setOldPass('');
      setNewPass('');
      setConfirmPass('');
    } catch {
      toast.error('Gagal mengubah kata sandi.');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl pb-10">
      {/* Informasi Profil */}
      <div className="bg-white border-4 border-[#1E3A5F] overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-[#1E3A5F] flex items-center gap-3 bg-[#FAFAFA]">
          <User className="w-5 h-5 text-[#1E3A5F]" />
          <h3 className="font-black text-[#1E3A5F]">Informasi Profil Petugas</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4 pb-5 border-b-2 border-slate-100">
            <div className="w-14 h-14 bg-blue-200 border-2 border-[#1E3A5F] flex items-center justify-center flex-shrink-0">
              <span className="text-[#1E3A5F] text-xl font-black">
                {user.nama.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-black text-lg text-[#1E3A5F]">{user.nama}</p>
              <p className="text-xs font-medium text-[#64748B]">{user.jabatan}</p>
              <span className="inline-block border border-[#1E3A5F] px-2.5 py-0.5 text-[11px] font-bold bg-blue-100 text-[#1E3A5F] mt-1.5">
                Administrator Kelurahan
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1E3A5F] mb-1.5">
                Nama Lengkap Petugas
              </label>
              <input
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="w-full px-3.5 py-2.5 border-2 border-[#1E3A5F] text-sm font-bold text-[#1E3A5F] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1E3A5F] mb-1.5">
                Jabatan
              </label>
              <input
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                className="w-full px-3.5 py-2.5 border-2 border-[#1E3A5F] text-sm font-bold text-[#1E3A5F] focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#1E3A5F] mb-1.5">
                Username Login
              </label>
              <input
                value={user.username}
                disabled
                className="w-full px-3.5 py-2.5 border-2 border-slate-300 text-sm font-bold bg-slate-100 text-[#64748B] cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveProfile}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#1E3A5F] bg-[#1E3A5F] text-white text-xs font-bold hover:bg-blue-900 transition-colors"
            >
              <Save className="w-4 h-4" />
              Simpan Perubahan Profil
            </button>
          </div>
        </div>
      </div>

      {/* Ubah Kata Sandi */}
      <div className="bg-white border-4 border-[#1E3A5F] overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-[#1E3A5F] flex items-center gap-3 bg-[#FAFAFA]">
          <Lock className="w-5 h-5 text-[#1E3A5F]" />
          <h3 className="font-black text-[#1E3A5F]">Ubah Kata Sandi</h3>
        </div>
        <div className="p-6 space-y-4">
          {[
            {
              label: 'Kata Sandi Lama',
              value: oldPass,
              set: setOldPass,
              show: showOld,
              toggle: () => setShowOld(!showOld),
            },
            {
              label: 'Kata Sandi Baru (Minimal 6 karakter)',
              value: newPass,
              set: setNewPass,
              show: showNew,
              toggle: () => setShowNew(!showNew),
            },
            {
              label: 'Ulangi Kata Sandi Baru',
              value: confirmPass,
              set: setConfirmPass,
              show: showConfirm,
              toggle: () => setShowConfirm(!showConfirm),
            },
          ].map((field) => (
            <div key={field.label}>
              <label className="block text-xs font-bold text-[#1E3A5F] mb-1.5">
                {field.label}
              </label>
              <div className="relative">
                <input
                  type={field.show ? 'text' : 'password'}
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-12 border-2 border-[#1E3A5F] text-sm font-bold focus:outline-none"
                />
                <button
                  type="button"
                  onClick={field.toggle}
                  className="absolute right-0 top-0 h-full px-4 flex items-center justify-center text-[#64748B] hover:text-[#1E3A5F]"
                >
                  {field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <button
              onClick={savePassword}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#1E3A5F] bg-[#1E3A5F] text-white text-xs font-bold hover:bg-blue-900 transition-colors"
            >
              <Save className="w-4 h-4" />
              Simpan Kata Sandi Baru
            </button>
          </div>
        </div>
      </div>

      {/* Tentang Sistem */}
      <div className="bg-white border-4 border-[#1E3A5F] overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-[#1E3A5F] flex items-center gap-3 bg-[#FAFAFA]">
          <Settings2 className="w-5 h-5 text-[#1E3A5F]" />
          <h3 className="font-black text-[#1E3A5F]">Informasi Sistem</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {[
              { label: 'Nama Aplikasi', value: 'SPK Prioritas Bantuan Sosial Kelurahan' },
              { label: 'Metode Perhitungan', value: 'AHP-TOPSIS (3 Kriteria)' },
              { label: 'Kriteria Utama', value: 'Desil Ekonomi, Pemerataan Bantuan, Wilayah RT/RW' },
              { label: 'Hak Akses Aktif', value: 'Administrator / Petugas Kelurahan' },
            ].map((item, i) => (
              <div key={i} className="bg-[#FAFAFA] border-2 border-[#1E3A5F] p-3.5">
                <p className="text-[#64748B] font-medium mb-1">{item.label}</p>
                <p className="font-black text-sm text-[#1E3A5F]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
