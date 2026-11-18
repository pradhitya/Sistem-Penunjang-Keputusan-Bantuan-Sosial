import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Download,
  Search,
  ArrowUpDown,
  Info,
  RefreshCw,
  Upload,
  ChevronLeft,
  ChevronRight,
  Award,
  Eye,
  X,
  User,
  MapPin,
  FileText,
} from 'lucide-react';
import { AppData } from '../../data';

interface Props {
  data?: AppData;
  setData?: (d: AppData) => void;
}

interface PriorityRow {
  seq: number;
  excel_row_number: number;
  id_anonim: string;
  nik: string;
  no_kk: string;
  no_pbp: string;
  nama: string;
  tanggal_lahir: string;
  hubungan_keluarga: string;
  usia: number | null;
  alamat: string;
  rw: string;
  rt: string;
  desil: number;
  jumlah_program: number;
  bansos_raw: string;
  status_bansos: string;
  label_status_bansos: string;
  keterangan_raw: string;
  skor_desil: number;
  skor_bansos: number;
  skor_rtrw: number;
  proporsi_rtrw_smoothed: number | null;
  d_plus: number;
  d_minus: number;
  nilai_c: number;
  peringkat: number;
  persentase_kumulatif: number;
  kelompok: string;
  kelompok_label: string;
}

export function HasilSAW(_props: Props) {
  const [rows, setRows] = useState<PriorityRow[]>([]);
  const [meta, setMeta] = useState<{
    total_ranked: number;
    total_filtered: number;
    page: number;
    per_page: number;
    total_pages: number;
    available_rws: string[];
    weights: Record<string, number>;
    ideal_positive: Record<string, number>;
    ideal_negative: Record<string, number>;
  }>({
    total_ranked: 0,
    total_filtered: 0,
    page: 1,
    per_page: 50,
    total_pages: 1,
    available_rws: [],
    weights: { C1: 0.633, C2: 0.261, C3: 0.106 },
    ideal_positive: {},
    ideal_negative: {},
  });

  const [search, setSearch] = useState('');
  const [rwFilter, setRwFilter] = useState('all');
  const [desilFilter, setDesilFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [kelompokFilter, setKelompokFilter] = useState('all');
  const [sortBy, setSortBy] = useState('peringkat');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedWarga, setSelectedWarga] = useState<PriorityRow | null>(null);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ahp-topsis/results', {
        params: {
          search,
          rw: rwFilter,
          desil: desilFilter,
          jumlah_program: programFilter,
          kelompok: kelompokFilter,
          sort_by: sortBy,
          sort_dir: sortDir,
          page,
          per_page: perPage,
        },
      });
      setRows(res.data.rows || []);
      if (res.data.meta) {
        setMeta(res.data.meta);
      }
    } catch (err) {
      console.error('Gagal memuat hasil urutan prioritas', err);
      toast.error('Gagal memuat daftar urutan prioritas warga.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [rwFilter, desilFilter, programFilter, kelompokFilter, sortBy, sortDir, page, perPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchResults();
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir(col === 'nilai_c' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const handleExportExcel = () => {
    window.open('/api/ahp-topsis/export-xlsx', '_blank');
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setPage(1);
      fetchResults();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal memperbarui data warga.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getKelompokInfo = (kelompok: string) => {
    switch (kelompok) {
      case '10%':
        return {
          badge: 'bg-emerald-300 text-[#1E3A5F]',
          label: 'Prioritas 1 (Sangat Mendesak)',
          desc: 'Didahulukan pada kuota tahap pertama',
        };
      case '30%':
        return {
          badge: 'bg-blue-200 text-[#1E3A5F]',
          label: 'Prioritas 2 (Mendesak)',
          desc: 'Diusulkan pada kuota tahap kedua',
        };
      case '60%':
        return {
          badge: 'bg-amber-200 text-[#1E3A5F]',
          label: 'Prioritas 3 (Cukup Mendesak)',
          desc: 'Daftar cadangan penerima bantuan',
        };
      default:
        return {
          badge: 'bg-slate-200 text-[#1E3A5F]',
          label: 'Prioritas 4 (Prioritas Rendah)',
          desc: 'Sudah menerima bantuan / kondisi lebih baik',
        };
    }
  };

  const getDesilInfo = (desil: number) => {
    switch (desil) {
      case 1:
        return { label: 'Desil 1', desc: 'Sangat Miskin', style: 'bg-red-100 text-red-900 border-red-800' };
      case 2:
        return { label: 'Desil 2', desc: 'Miskin', style: 'bg-amber-100 text-amber-900 border-amber-800' };
      case 3:
        return { label: 'Desil 3', desc: 'Hampir Miskin', style: 'bg-blue-100 text-blue-900 border-blue-800' };
      default:
        return { label: `Desil ${desil}`, desc: 'Rentan', style: 'bg-slate-100 text-slate-800 border-slate-700' };
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Catatan Penting */}
      <div className="bg-amber-200 border-4 border-[#1E3A5F] p-4 flex items-center gap-3">
        <Info className="w-5 h-5 text-[#1E3A5F] flex-shrink-0" />
        <p className="text-sm font-bold text-[#1E3A5F]">
          Hasil adalah urutan prioritas pendukung keputusan, bukan penetapan layak atau tidak layak.
        </p>
      </div>

      {/* Header & Ringkasan Bobot */}
      <div className="bg-white border-4 border-[#1E3A5F] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] mb-2">
              <Award className="w-3.5 h-3.5" />
              Daftar Urutan Prioritas Bantuan Sosial
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[#1E3A5F] tracking-tight">
              Hasil Prioritas Calon Penerima Bantuan
            </h2>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Menampilkan <strong className="text-[#1E3A5F]">{meta.total_filtered.toLocaleString('id-ID')}</strong> dari total{' '}
              <strong className="text-[#1E3A5F]">{meta.total_ranked.toLocaleString('id-ID')}</strong> warga yang masuk perhitungan prioritas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-bold hover:bg-slate-100 transition-colors">
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Memproses...' : 'Perbarui Data Warga'}</span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleUploadExcel}
                disabled={uploading}
              />
            </label>

            <button
              onClick={fetchResults}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Muat Ulang
            </button>

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-400 text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-black hover:bg-emerald-300 transition-colors"
            >
              <Download className="w-4 h-4" />
              Unduh Data Prioritas
            </button>
          </div>
        </div>

        {/* Kartu Ringkasan Bobot Penilaian */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t-2 border-slate-100">
          <div className="bg-[#FAFAFA] border-2 border-[#1E3A5F] p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#64748B]">1. Kondisi Ekonomi (Desil)</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Desil 1 mendapat prioritas tertinggi</p>
            </div>
            <span className="text-xl font-black text-[#1E3A5F]">
              {((meta.weights?.C1 ?? 0.633) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="bg-[#FAFAFA] border-2 border-[#1E3A5F] p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#64748B]">2. Pemerataan Bantuan</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Warga belum menerima bantuan diprioritaskan</p>
            </div>
            <span className="text-xl font-black text-[#1E3A5F]">
              {((meta.weights?.C2 ?? 0.261) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="bg-[#FAFAFA] border-2 border-[#1E3A5F] p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#64748B]">3. Kondisi Wilayah RT/RW</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                {meta.weights?.C3 ? 'Kepadatan warga prasejahtera di RT/RW' : 'Kriteria wilayah dinonaktifkan'}
              </p>
            </div>
            <span className="text-xl font-black text-[#1E3A5F]">
              {((meta.weights?.C3 ?? 0) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Pencarian & Penyaringan Data */}
      <div className="bg-white border-4 border-[#1E3A5F] p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <form onSubmit={handleSearchSubmit} className="relative lg:col-span-2 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari Nama, NIK, No. KK, Alamat, atau RT/RW..."
                className="w-full pl-9 pr-3 py-2 bg-[#FAFAFA] border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#1E3A5F] text-white border-2 border-[#1E3A5F] text-xs font-black hover:bg-[#2563EB] transition-colors"
            >
              Cari
            </button>
          </form>

          <select
            value={rwFilter}
            onChange={(e) => {
              setRwFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]"
          >
            <option value="all">Semua RW ({meta.available_rws.length} Wilayah)</option>
            {meta.available_rws.map((rw) => (
              <option key={rw} value={rw}>
                Wilayah RW {rw}
              </option>
            ))}
          </select>

          <select
            value={desilFilter}
            onChange={(e) => {
              setDesilFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]"
          >
            <option value="all">Semua Kelompok Desil</option>
            <option value="1">Desil 1 (Sangat Miskin)</option>
            <option value="2">Desil 2 (Miskin)</option>
            <option value="3">Desil 3 (Hampir Miskin)</option>
            <option value="4">Desil 4 (Rentan)</option>
          </select>

          <select
            value={kelompokFilter}
            onChange={(e) => {
              setKelompokFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]"
          >
            <option value="all">Semua Tingkat Prioritas</option>
            <option value="10%">Prioritas 1 — Sangat Mendesak</option>
            <option value="30%">Prioritas 2 — Mendesak</option>
            <option value="60%">Prioritas 3 — Cukup Mendesak (Cadangan)</option>
            <option value="100%">Prioritas 4 — Prioritas Rendah</option>
          </select>
        </div>

        {/* Keterangan Singkat Arti Tingkat Prioritas agar Orang Awam Paham */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t-2 border-slate-100 text-xs">
          <div className="p-2.5 bg-emerald-50 border border-emerald-400">
            <span className="font-black text-[#1E3A5F] block">Prioritas 1 (Sangat Mendesak)</span>
            <span className="text-[11px] text-[#475569]">
              Warga paling membutuhkan (umumnya miskin & belum dapat bantuan). Wajib didahulukan.
            </span>
          </div>
          <div className="p-2.5 bg-blue-50 border border-blue-300">
            <span className="font-black text-[#1E3A5F] block">Prioritas 2 (Mendesak)</span>
            <span className="text-[11px] text-[#475569]">
              Diusulkan menerima bantuan pada tahap kedua setelah Prioritas 1 terpenuhi.
            </span>
          </div>
          <div className="p-2.5 bg-amber-50 border border-amber-300">
            <span className="font-black text-[#1E3A5F] block">Prioritas 3 (Cukup Mendesak)</span>
            <span className="text-[11px] text-[#475569]">
              Daftar cadangan jika masih ada sisa kuota bantuan sosial di kelurahan.
            </span>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-300">
            <span className="font-black text-[#1E3A5F] block">Prioritas 4 (Prioritas Rendah)</span>
            <span className="text-[11px] text-[#475569]">
              Warga yang sudah menerima beberapa bantuan atau kondisi ekonominya lebih baik.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#64748B]">Status Bantuan Saat Ini:</span>
            {[
              { val: 'all', label: 'Semua Warga' },
              { val: '0', label: 'Belum Tercatat Menerima (0)' },
              { val: '1', label: 'Menerima Sembako (1)' },
              { val: '2', label: 'Menerima Sembako & PKH (2)' },
            ].map((btn) => (
              <button
                key={btn.val}
                onClick={() => {
                  setProgramFilter(btn.val);
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-bold border-2 border-[#1E3A5F] transition-colors ${
                  programFilter === btn.val
                    ? 'bg-[#1E3A5F] text-white'
                    : 'bg-white text-[#1E3A5F] hover:bg-slate-50'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#64748B]">Tampilkan:</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="px-2.5 py-1 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] bg-white"
            >
              <option value={25}>25 warga</option>
              <option value={50}>50 warga</option>
              <option value={100}>100 warga</option>
              <option value={250}>250 warga</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabel Hasil Prioritas Lengkap */}
      <div className="bg-white border-4 border-[#1E3A5F] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1E3A5F] text-white text-xs font-bold">
                <th
                  onClick={() => toggleSort('peringkat')}
                  className="p-3 border-r border-white/20 cursor-pointer hover:bg-white/10 whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Peringkat <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('nama')}
                  className="p-3 border-r border-white/20 cursor-pointer hover:bg-white/10 min-w-[200px]"
                >
                  <div className="flex items-center gap-1">
                    Nama Lengkap & Hubungan <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('nik')}
                  className="p-3 border-r border-white/20 cursor-pointer hover:bg-white/10 whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    NIK & Nomor KK <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('rw')}
                  className="p-3 border-r border-white/20 cursor-pointer hover:bg-white/10 min-w-[180px]"
                >
                  <div className="flex items-center gap-1">
                    Alamat & RT/RW <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('desil')}
                  className="p-3 border-r border-white/20 text-center cursor-pointer hover:bg-white/10 whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Kelompok Desil <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('jumlah_program')}
                  className="p-3 border-r border-white/20 cursor-pointer hover:bg-white/10 whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Status Bantuan <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('nilai_c')}
                  className="p-3 border-r border-white/20 text-center cursor-pointer hover:bg-white/10 whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Skor Prioritas <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="p-3 border-r border-white/20 text-center whitespace-nowrap">
                  Tingkat Prioritas
                </th>
                <th className="p-3 text-center whitespace-nowrap">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-200 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center font-bold text-[#1E3A5F] text-sm">
                    Memuat daftar urutan prioritas warga...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center font-bold text-[#64748B] text-sm">
                    Tidak ada data warga yang sesuai dengan kata kunci atau filter yang dipilih.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const desilInfo = getDesilInfo(row.desil);
                  const kelompokInfo = getKelompokInfo(row.kelompok);
                  return (
                    <tr
                      key={row.id_anonim}
                      className="hover:bg-blue-50/40 transition-colors"
                    >
                      {/* Peringkat */}
                      <td className="p-3 font-black text-[#1E3A5F] border-r border-slate-200">
                        <span className="inline-block px-2.5 py-1 bg-[#1E3A5F] text-white font-mono text-xs">
                          #{row.peringkat}
                        </span>
                        <span className="block text-[10px] font-mono text-[#64748B] mt-1">
                          {row.id_anonim}
                        </span>
                      </td>

                      {/* Nama Lengkap, Usia, Tanggal Lahir, Hubungan */}
                      <td className="p-3 border-r border-slate-200">
                        <p className="font-black text-[#1E3A5F] text-sm leading-snug">
                          {row.nama || '-'}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-[#64748B]">
                          {row.hubungan_keluarga && (
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 font-semibold text-[#1E3A5F]">
                              {row.hubungan_keluarga}
                            </span>
                          )}
                          {row.usia !== null && <span>• {row.usia} thn</span>}
                          {row.tanggal_lahir && <span>({row.tanggal_lahir})</span>}
                        </div>
                      </td>

                      {/* NIK & No KK */}
                      <td className="p-3 border-r border-slate-200 font-mono">
                        <div className="space-y-1">
                          <div>
                            <span className="text-[10px] font-sans font-bold text-[#64748B] block">
                              NIK:
                            </span>
                            <span className="font-bold text-[#1E3A5F]">{row.nik || '-'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-sans font-bold text-[#64748B] block">
                              No. KK:
                            </span>
                            <span className="text-[#475569]">{row.no_kk || '-'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Alamat & RT/RW */}
                      <td className="p-3 border-r border-slate-200">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 border border-[#1E3A5F] font-bold text-[#1E3A5F] text-[11px] mb-1">
                          RT {row.rt} / RW {row.rw}
                        </span>
                        <p className="text-xs text-[#475569] leading-snug">
                          {row.alamat || '-'}
                        </p>
                      </td>

                      {/* Desil */}
                      <td className="p-3 text-center border-r border-slate-200">
                        <span
                          className={`inline-block px-2.5 py-0.5 border font-black text-xs ${desilInfo.style}`}
                        >
                          {desilInfo.label}
                        </span>
                        <span className="block text-[11px] font-medium text-[#64748B] mt-1">
                          {desilInfo.desc}
                        </span>
                      </td>

                      {/* Status Bantuan */}
                      <td className="p-3 border-r border-slate-200">
                        {row.jumlah_program === 0 ? (
                          <div>
                            <span className="inline-block px-2 py-0.5 bg-amber-100 border border-amber-700 text-amber-900 font-bold text-[11px]">
                              Belum Tercatat
                            </span>
                            <span className="block text-[11px] text-[#64748B] mt-0.5">
                              0 program bantuan
                            </span>
                          </div>
                        ) : row.jumlah_program === 1 ? (
                          <div>
                            <span className="inline-block px-2 py-0.5 bg-blue-100 border border-blue-700 text-blue-900 font-bold text-[11px]">
                              Sembako
                            </span>
                            <span className="block text-[11px] text-[#64748B] mt-0.5">
                              1 program bantuan
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-block px-2 py-0.5 bg-emerald-100 border border-emerald-700 text-emerald-900 font-bold text-[11px]">
                              Sembako + PKH
                            </span>
                            <span className="block text-[11px] text-[#64748B] mt-0.5">
                              2 program bantuan
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Nilai Preferensi & Ringkasan Skor */}
                      <td className="p-3 text-center border-r border-slate-200 bg-blue-50/30">
                        <span className="text-sm font-black font-mono text-[#1E3A5F]">
                          {(row.nilai_c * 100).toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-[#64748B]">
                          dari 100
                        </span>
                      </td>

                      {/* Kelompok Prioritas */}
                      <td className="p-3 text-center border-r border-slate-200">
                        <span
                          className={`inline-block px-2.5 py-1 border-2 border-[#1E3A5F] text-[11px] font-black ${kelompokInfo.badge}`}
                        >
                          {kelompokInfo.label}
                        </span>
                        <span className="block text-[11px] font-medium text-[#64748B] mt-1">
                          {kelompokInfo.desc}
                        </span>
                      </td>

                      {/* Tombol Detail */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedWarga(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Navigasi Halaman */}
        <div className="bg-[#FAFAFA] border-t-4 border-[#1E3A5F] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold text-[#1E3A5F]">
            Halaman <strong>{meta.page}</strong> dari <strong>{meta.total_pages}</strong> • Total{' '}
            <strong>{meta.total_filtered.toLocaleString('id-ID')}</strong> warga
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] disabled:opacity-40 hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </button>
            <button
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] disabled:opacity-40 hover:bg-slate-100"
            >
              Berikutnya <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detail Lengkap Warga & Rincian Skor */}
      {selectedWarga && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-[#1E3A5F] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-[#1E3A5F] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-blue-200">
                  Peringkat #{selectedWarga.peringkat} • {selectedWarga.id_anonim}
                </span>
                <h3 className="text-lg font-black tracking-tight mt-0.5">
                  {selectedWarga.nama || 'Detail Data Warga'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedWarga(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Identitas Lengkap */}
              <div>
                <h4 className="text-xs font-black text-[#1E3A5F] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" /> Data Identitas & Keluarga
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAFAFA] border-2 border-[#1E3A5F] p-4 text-xs">
                  <div>
                    <span className="text-[#64748B] block">Nama Lengkap</span>
                    <strong className="text-[#1E3A5F] text-sm">{selectedWarga.nama || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Hubungan dalam Keluarga</span>
                    <strong className="text-[#1E3A5F]">{selectedWarga.hubungan_keluarga || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">NIK</span>
                    <strong className="font-mono text-[#1E3A5F]">{selectedWarga.nik || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Nomor Kartu Keluarga (No. KK)</span>
                    <strong className="font-mono text-[#1E3A5F]">{selectedWarga.no_kk || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Tanggal Lahir & Usia</span>
                    <strong className="text-[#1E3A5F]">
                      {selectedWarga.tanggal_lahir || '-'}{' '}
                      {selectedWarga.usia !== null ? `(${selectedWarga.usia} tahun)` : ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Nomor PBP</span>
                    <strong className="font-mono text-[#1E3A5F]">{selectedWarga.no_pbp || '-'}</strong>
                  </div>
                </div>
              </div>

              {/* Alamat & Wilayah */}
              <div>
                <h4 className="text-xs font-black text-[#1E3A5F] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Domisili & Wilayah
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#FAFAFA] border-2 border-[#1E3A5F] p-4 text-xs">
                  <div className="sm:col-span-2">
                    <span className="text-[#64748B] block">Alamat Lengkap</span>
                    <strong className="text-[#1E3A5F]">{selectedWarga.alamat || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">RT / RW</span>
                    <strong className="text-[#1E3A5F]">
                      RT {selectedWarga.rt} / RW {selectedWarga.rw}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Rincian Penilaian Prioritas */}
              <div>
                <h4 className="text-xs font-black text-[#1E3A5F] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Rincian Penilaian Prioritas
                </h4>
                <div className="border-2 border-[#1E3A5F] divide-y divide-slate-200 text-xs">
                  <div className="p-3 flex items-center justify-between bg-slate-50">
                    <div>
                      <strong className="text-[#1E3A5F] block">1. Kelompok Ekonomi (Desil)</strong>
                      <span className="text-[#64748B]">
                        Terdata di Desil {selectedWarga.desil} ({getDesilInfo(selectedWarga.desil).desc})
                      </span>
                    </div>
                    <span className="font-mono font-black text-sm text-[#1E3A5F]">
                      Skor: {selectedWarga.skor_desil.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <strong className="text-[#1E3A5F] block">2. Status Pemerataan Bantuan</strong>
                      <span className="text-[#64748B]">
                        {selectedWarga.label_status_bansos} ({selectedWarga.jumlah_program} program)
                      </span>
                    </div>
                    <span className="font-mono font-black text-sm text-[#1E3A5F]">
                      Skor: {selectedWarga.skor_bansos.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-between bg-slate-50">
                    <div>
                      <strong className="text-[#1E3A5F] block">3. Prioritas Wilayah (RT {selectedWarga.rt} / RW {selectedWarga.rw})</strong>
                      <span className="text-[#64748B]">
                        Berdasarkan kepadatan warga Desil 1 & 2 di wilayah setempat
                      </span>
                    </div>
                    <span className="font-mono font-black text-sm text-[#1E3A5F]">
                      Skor: {selectedWarga.skor_rtrw.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-4 flex items-center justify-between bg-blue-50">
                    <div>
                      <strong className="text-[#1E3A5F] text-sm block">
                        {getKelompokInfo(selectedWarga.kelompok).label}
                      </strong>
                      <span className="text-[#64748B]">
                        {getKelompokInfo(selectedWarga.kelompok).desc}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#1E3A5F] block">
                        Peringkat #{selectedWarga.peringkat}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#475569]">
                        Skor Prioritas: {(selectedWarga.nilai_c * 100).toFixed(2)} dari 100
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedWarga(null)}
                  className="px-5 py-2 bg-[#1E3A5F] text-white text-xs font-bold hover:bg-[#2563EB] transition-colors"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
