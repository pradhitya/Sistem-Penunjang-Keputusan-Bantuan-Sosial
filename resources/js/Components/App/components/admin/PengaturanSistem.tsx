import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AppData } from '../../data';
import {
  Database,
  Upload,
  Download,
  RotateCcw,
  CheckCircle2,
  Users,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  data: AppData;
  setData: (data: AppData) => void;
}

export function PengaturanSistem(_props: Props) {
  const [summary, setSummary] = useState<{
    total_rows: number;
    eligible_for_ranking_count: number;
    excluded_count: number;
    needs_review_count: number;
  } | null>(null);
  const [editCount, setEditCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ahp-topsis/overview');
      setSummary(res.data.summary || null);
      setEditCount((res.data.edit_logs || []).length);
    } catch (err) {
      console.error('Gagal memuat informasi data sistem', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleUploadData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post('/api/ahp-topsis/import-xlsx', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message || 'Data warga berhasil diperbarui dan dihitung ulang.');
      fetchOverview();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal memperbarui data warga.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleResetEdits = async () => {
    if (
      !window.confirm(
        'Apakah Anda yakin ingin menghapus semua koreksi manual petugas dan memuat ulang data warga asli?'
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      const res = await axios.post('/api/ahp-topsis/import-xlsx', {
        clear_overrides: true,
      });
      toast.success(res.data.message || 'Data warga berhasil dikembalikan ke data awal.');
      fetchOverview();
    } catch (err: any) {
      toast.error('Gagal memuat ulang data awal.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Ringkasan Kondisi Data Aktif */}
      <div className="bg-white border-4 border-[#1E3A5F] p-6 space-y-5">
        <div className="flex items-center gap-3 border-b-2 border-slate-200 pb-4">
          <div className="w-10 h-10 bg-[#1E3A5F] text-white flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#1E3A5F]">
              Status Data Warga Kelurahan Saat Ini
            </h3>
            <p className="text-xs text-[#64748B]">
              Kelola pembaruan data warga, unduh laporan hasil prioritas, atau muat ulang data awal.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm font-bold text-[#1E3A5F] py-4">Memuat ringkasan data...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FAFAFA] border-2 border-[#1E3A5F] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#64748B]">
                <Users className="w-4 h-4 text-[#1E3A5F]" /> Total Warga Terdata
              </div>
              <p className="text-2xl font-black text-[#1E3A5F] mt-1">
                {(summary?.total_rows ?? 0).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="bg-emerald-50 border-2 border-[#1E3A5F] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1E3A5F]">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Masuk Urutan Prioritas
              </div>
              <p className="text-2xl font-black text-emerald-900 mt-1">
                {(summary?.eligible_for_ranking_count ?? 0).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="bg-rose-50 border-2 border-[#1E3A5F] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1E3A5F]">
                <ShieldAlert className="w-4 h-4 text-rose-700" /> Tidak Masuk Peringkat
              </div>
              <p className="text-2xl font-black text-rose-900 mt-1">
                {(summary?.excluded_count ?? 0).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="bg-amber-50 border-2 border-[#1E3A5F] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1E3A5F]">
                <AlertTriangle className="w-4 h-4 text-amber-700" /> Perlu Dicek Petugas
              </div>
              <p className="text-2xl font-black text-amber-900 mt-1">
                {(summary?.needs_review_count ?? 0).toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        )}

        {/* Aksi Pengelolaan Data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="border-2 border-[#1E3A5F] p-4 bg-[#FAFAFA] flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-sm font-black text-[#1E3A5F]">1. Perbarui Data Warga Baru</h4>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Unggah file data warga terbaru (format .xlsx) untuk memperbarui seluruh daftar dan menghitung ulang urutan prioritas secara otomatis.
              </p>
            </div>
            <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1E3A5F] text-white border-2 border-[#1E3A5F] text-xs font-bold hover:bg-blue-900 transition-colors">
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Memproses Data...' : 'Pilih & Unggah Data (.xlsx)'}</span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleUploadData}
                disabled={uploading}
              />
            </label>
          </div>

          <div className="border-2 border-[#1E3A5F] p-4 bg-[#FAFAFA] flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-sm font-black text-[#1E3A5F]">2. Unduh Laporan Hasil Prioritas</h4>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Unduh daftar lengkap hasil urutan prioritas warga beserta Nama, NIK, Nomor KK, Alamat, RT/RW, Desil, dan Tingkat Prioritas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.open('/api/ahp-topsis/export-xlsx', '_blank')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-400 text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-black hover:bg-emerald-300 transition-colors"
            >
              <Download className="w-4 h-4" />
              Unduh Data Prioritas
            </button>
          </div>

          <div className="border-2 border-[#1E3A5F] p-4 bg-[#FAFAFA] flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-sm font-black text-[#1E3A5F]">
                3. Kembalikan Data ke Kondisi Awal
              </h4>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Saat ini terdapat <strong>{editCount} catatan perbaikan petugas</strong>. Gunakan tombol ini jika ingin menghapus koreksi manual dan membaca ulang file asli.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetEdits}
              disabled={resetting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-rose-700 border-2 border-[#1E3A5F] text-xs font-bold hover:bg-rose-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {resetting ? 'Memuat Ulang...' : 'Muat Ulang Data Asli'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
