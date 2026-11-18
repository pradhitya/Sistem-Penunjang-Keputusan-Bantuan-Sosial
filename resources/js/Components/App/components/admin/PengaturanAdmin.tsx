import { useState } from 'react';
import { User, AppData } from '../../data';
import { ManajemenPengguna } from './ManajemenPengguna';
import { PengaturanSistem } from './PengaturanSistem';
import { PengaturanAkun } from '../shared/PengaturanAkun';
import { UserCog, Database, Shield } from 'lucide-react';

interface Props {
  user: User;
  data: AppData;
  setData: (d: AppData) => void;
}

export function PengaturanAdmin({ user, data, setData }: Props) {
  const [activeTab, setActiveTab] = useState<'sistem' | 'pengguna' | 'akun'>('sistem');

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-white border-4 border-[#1E3A5F] p-6">
        <h2 className="text-2xl md:text-3xl font-black text-[#1E3A5F] tracking-tight">
          Pengaturan Sistem & Akun
        </h2>
        <p className="text-sm font-medium text-[#64748B] mt-1">
          Kelola pembaruan data warga kelurahan, daftar akun petugas pengelola, serta profil dan kata sandi Anda.
        </p>

        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t-2 border-slate-100">
          <button
            onClick={() => setActiveTab('sistem')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-2 border-[#1E3A5F] transition-colors ${
              activeTab === 'sistem'
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-[#FAFAFA] text-[#1E3A5F] hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4" />
            Pengelolaan Data Warga
          </button>

          <button
            onClick={() => setActiveTab('akun')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-2 border-[#1E3A5F] transition-colors ${
              activeTab === 'akun'
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-[#FAFAFA] text-[#1E3A5F] hover:bg-slate-100'
            }`}
          >
            <UserCog className="w-4 h-4" />
            Profil & Kata Sandi Saya
          </button>

          <button
            onClick={() => setActiveTab('pengguna')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-2 border-[#1E3A5F] transition-colors ${
              activeTab === 'pengguna'
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-[#FAFAFA] text-[#1E3A5F] hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            Daftar Akun Petugas
          </button>
        </div>
      </div>

      <div>
        {activeTab === 'sistem' && <PengaturanSistem data={data} setData={setData} />}
        {activeTab === 'pengguna' && <ManajemenPengguna />}
        {activeTab === 'akun' && <PengaturanAkun user={user} />}
      </div>
    </div>
  );
}
