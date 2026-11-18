import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Search,
  Edit3,
  History,
  Users,
  Info,
  X,
  Save,
  RefreshCw,
  ClipboardCheck,
} from 'lucide-react';

interface FlaggedRow {
  seq: number;
  excel_row_number: number;
  id_anonim: string;
  nama: string;
  nik: string;
  no_kk: string;
  alamat: string;
  rw: string;
  rt: string;
  rw_raw: string;
  rt_raw: string;
  rt_rw_valid: boolean;
  desil: number | null;
  jumlah_program: number;
  bansos_raw: string;
  status_bansos: string;
  label_status_bansos: string;
  keterangan_raw: string;
  is_excluded: boolean;
  exclusion_reasons: string[];
  needs_review: boolean;
  review_reasons: string[];
  rw_population: number;
  rt_rw_population: number;
  peringkat: number | null;
}

interface KkMultipleItem {
  no_kk?: string;
  no_kk_masked: string;
  recipient_count: number;
  members: {
    seq: number;
    excel_row_number: number;
    id_anonim: string;
    nama?: string;
    nik?: string;
    hubungan_keluarga?: string;
    jumlah_program: number;
    bansos_raw: string;
    rw: string;
    rt: string;
    desil: number;
  }[];
}

interface EditLogItem {
  id: string;
  id_anonim: string;
  nama?: string;
  nik?: string;
  excel_row_number: number | null;
  edited_by: string;
  reason: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  created_at: string;
}

export function PerluDicekPetugas() {
  const [rows, setRows] = useState<FlaggedRow[]>([]);
  const [totalFlagged, setTotalFlagged] = useState(0);
  const [breakdown, setBreakdown] = useState({
    rtrw_invalid: 0,
    rtrw_rare: 0,
    rw_small: 0,
    rt_zero: 0,
    pindah_in_bansos: 0,
    kk_multiple_bansos: 0,
  });
  const [kkMultiple, setKkMultiple] = useState<KkMultipleItem[]>([]);
  const [editLogs, setEditLogs] = useState<EditLogItem[]>([]);
  const [disclaimer, setDisclaimer] = useState(
    'Hasil adalah urutan prioritas pendukung keputusan, bukan penetapan layak atau tidak layak.'
  );
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'baris' | 'kk' | 'audit'>('baris');
  const [loading, setLoading] = useState(true);

  // Modal Edit Warga oleh Petugas
  const [editingRow, setEditingRow] = useState<FlaggedRow | null>(null);
  const [formRw, setFormRw] = useState('');
  const [formRt, setFormRt] = useState('');
  const [formDesil, setFormDesil] = useState(1);
  const [formBansos, setFormBansos] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formEditedBy, setFormEditedBy] = useState(() => {
    try {
      const u = localStorage.getItem('spk_bansos_user');
      return u ? JSON.parse(u).nama || 'Petugas Kelurahan' : 'Petugas Kelurahan';
    } catch {
      return 'Petugas Kelurahan';
    }
  });
  const [formReason, setFormReason] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchReviewData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ahp-topsis/review', {
        params: { category, search },
      });
      setRows(res.data.rows || []);
      setTotalFlagged(res.data.total_flagged || 0);
      setBreakdown(res.data.reason_breakdown || breakdown);
      setKkMultiple(Object.values(res.data.kk_multiple_bansos || {}));
      setEditLogs(res.data.edit_logs || []);
      if (res.data.disclaimer) {
        setDisclaimer(res.data.disclaimer);
      }
    } catch (err) {
      console.error('Gagal memuat daftar perlu dicek petugas', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewData();
  }, [category]);

  const openEditModal = (row: FlaggedRow) => {
    setEditingRow(row);
    setFormRw(row.rw_raw || row.rw || '');
    setFormRt(row.rt_raw || row.rt || '');
    setFormDesil(row.desil || 1);
    setFormBansos(row.bansos_raw || '');
    setFormKeterangan(row.keterangan_raw || '');
    setFormReason('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    if (formEditedBy.trim().length < 2) {
      toast.error('Nama petugas wajib diisi.');
      return;
    }
    if (formReason.trim().length < 5) {
      toast.error('Alasan perubahan wajib diisi minimal 5 karakter.');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post('/api/ahp-topsis/update-warga', {
        id_anonim: editingRow.id_anonim,
        edited_by: formEditedBy.trim(),
        reason: formReason.trim(),
        rw_raw: formRw.trim(),
        rt_raw: formRt.trim(),
        desil: Number(formDesil),
        bansos_raw: formBansos.trim(),
        keterangan_raw: formKeterangan.trim(),
      });
      toast.success(res.data.message || 'Data warga berhasil diperbarui.');
      setEditingRow(null);
      fetchReviewData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan perubahan data warga.');
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const hay = [
      r.id_anonim,
      r.nama,
      r.nik,
      r.no_kk,
      r.alamat,
      `#${r.excel_row_number}`,
      r.rw_raw,
      r.rt_raw,
      r.bansos_raw,
      r.keterangan_raw,
      ...(r.review_reasons || []),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  const filterCards = [
    {
      id: 'rtrw_invalid',
      label: 'RT/RW Kosong / Salah Input',
      val: breakdown.rtrw_invalid,
      bg: 'bg-rose-50',
    },
    {
      id: 'rtrw_rare',
      label: 'RT/RW Warga Sedikit (≤3 orang)',
      val: breakdown.rtrw_rare,
      bg: 'bg-amber-50',
    },
    {
      id: 'rw_small',
      label: 'RW Warga Sedikit (≤5 orang)',
      val: breakdown.rw_small,
      bg: 'bg-orange-50',
    },
    {
      id: 'rt_zero',
      label: 'Nomor RT Bernilai 000',
      val: breakdown.rt_zero,
      bg: 'bg-yellow-50',
    },
    {
      id: 'pindah_in_bansos',
      label: 'Catatan Pindah di Kolom Bantuan',
      val: breakdown.pindah_in_bansos,
      bg: 'bg-purple-50',
    },
    {
      id: 'kk_multiple_bansos',
      label: '1 KK Lebih dari 1 Penerima',
      val: breakdown.kk_multiple_bansos,
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* Catatan Penting */}
      <div className="bg-amber-200 border-4 border-[#1E3A5F] p-4 flex items-center gap-3">
        <Info className="w-5 h-5 text-[#1E3A5F] flex-shrink-0" />
        <p className="text-sm font-bold text-[#1E3A5F]">{disclaimer}</p>
      </div>

      {/* Header */}
      <div className="bg-white border-4 border-[#1E3A5F] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] mb-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              Pemeriksaan & Perbaikan Data Warga
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[#1E3A5F] tracking-tight">
              Daftar Data Warga yang Perlu Dicek Petugas
            </h2>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Sistem menandai otomatis data warga yang perlu diperiksa ulang (seperti penulisan RT/RW yang janggal atau 1 Kartu Keluarga yang menerima lebih dari 1 bantuan). Klik kartu di bawah untuk menyaring daftar.
            </p>
          </div>

          <button
            onClick={fetchReviewData}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E3A5F] text-white border-2 border-[#1E3A5F] text-xs font-bold hover:bg-slate-800 transition-colors self-start"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
        </div>

        {/* Kartu Kategori Pemeriksaan */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          {filterCards.map((card) => (
            <button
              key={card.id}
              onClick={() => {
                setActiveSubTab('baris');
                setCategory(category === card.id ? 'all' : card.id);
              }}
              className={`text-left p-3.5 border-2 border-[#1E3A5F] transition-all ${
                category === card.id
                  ? 'bg-[#1E3A5F] text-white'
                  : `${card.bg} text-[#1E3A5F] hover:opacity-90`
              }`}
            >
              <p className="text-xs font-bold leading-snug">{card.label}</p>
              <p className="text-2xl font-black mt-1.5">
                {card.val} <span className="text-xs font-normal opacity-80">warga</span>
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Navigasi */}
      <div className="bg-[#1E3A5F] p-2 border-4 border-[#1E3A5F] flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSubTab('baris')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-2 transition-colors ${
            activeSubTab === 'baris'
              ? 'bg-white text-[#1E3A5F] border-white'
              : 'text-white border-transparent hover:bg-white/10'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Daftar Warga Perlu Dicek ({totalFlagged})
        </button>

        <button
          onClick={() => setActiveSubTab('kk')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-2 transition-colors ${
            activeSubTab === 'kk'
              ? 'bg-white text-[#1E3A5F] border-white'
              : 'text-white border-transparent hover:bg-white/10'
          }`}
        >
          <Users className="w-4 h-4" />
          1 KK Lebih dari 1 Penerima Bantuan ({kkMultiple.length} Keluarga)
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-2 transition-colors ${
            activeSubTab === 'audit'
              ? 'bg-white text-[#1E3A5F] border-white'
              : 'text-white border-transparent hover:bg-white/10'
          }`}
        >
          <History className="w-4 h-4" />
          Riwayat Perbaikan Petugas ({editLogs.length})
        </button>
      </div>

      {activeSubTab === 'baris' && (
        <>
          {/* Filter & Pencarian */}
          <div className="bg-white border-4 border-[#1E3A5F] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCategory('all')}
                className={`px-3.5 py-1.5 text-xs font-bold border-2 border-[#1E3A5F] ${
                  category === 'all' ? 'bg-[#1E3A5F] text-white' : 'bg-white text-[#1E3A5F]'
                }`}
              >
                Tampilkan Semua ({totalFlagged})
              </button>
              {category !== 'all' && (
                <span className="px-3 py-1.5 bg-amber-200 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]">
                  Menampilkan: {filterCards.find((c) => c.id === category)?.label} ({filteredRows.length} warga)
                </span>
              )}
            </div>

            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari Nama, NIK, No. KK, Alamat, RT/RW..."
                className="w-full pl-9 pr-4 py-2 bg-[#FAFAFA] border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] focus:outline-none"
              />
            </div>
          </div>

          {/* Tabel Warga Perlu Dicek */}
          <div className="bg-white border-4 border-[#1E3A5F] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1E3A5F] text-white text-xs font-bold">
                    <th className="p-3 border-r border-white/20">No. Data</th>
                    <th className="p-3 border-r border-white/20">Nama Lengkap & NIK</th>
                    <th className="p-3 border-r border-white/20">Alamat & RT/RW</th>
                    <th className="p-3 border-r border-white/20 text-center">Desil</th>
                    <th className="p-3 border-r border-white/20">Status Bantuan</th>
                    <th className="p-3 border-r border-white/20">Catatan Pemeriksaan</th>
                    <th className="p-3 text-center">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-200 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center font-bold text-[#1E3A5F]">
                        Memuat daftar pemeriksaan petugas...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center font-bold text-[#64748B]">
                        Tidak ada data warga pada kategori ini.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.slice(0, 200).map((row) => (
                      <tr key={row.id_anonim} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-[#1E3A5F] border-r border-slate-200">
                          <span className="inline-block px-2 py-0.5 bg-amber-100 border border-[#1E3A5F] font-mono">
                            #{row.excel_row_number}
                          </span>
                          <span className="block text-[10px] font-mono text-[#64748B] mt-1">
                            {row.id_anonim}
                          </span>
                        </td>
                        <td className="p-3 border-r border-slate-200">
                          <p className="font-black text-[#1E3A5F] text-sm">{row.nama || '-'}</p>
                          <p className="font-mono text-[11px] text-[#64748B] mt-0.5">
                            NIK: {row.nik || '-'}
                          </p>
                          <p className="font-mono text-[11px] text-[#64748B]">
                            KK: {row.no_kk || '-'}
                          </p>
                          {row.is_excluded && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-rose-100 border border-rose-400 text-[10px] font-bold text-rose-800">
                              Belum Masuk Peringkat
                            </span>
                          )}
                        </td>
                        <td className="p-3 border-r border-slate-200">
                          <p className="text-xs text-[#1E3A5F] font-medium mb-1">
                            {row.alamat || '-'}
                          </p>
                          {row.rt_rw_valid ? (
                            <span className="inline-block px-2 py-0.5 bg-slate-100 border border-[#1E3A5F] font-bold text-[#1E3A5F] text-[11px]">
                              RT {row.rt} / RW {row.rw}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 bg-rose-50 border border-rose-400 font-bold text-rose-700 text-[11px]">
                              RW: "{row.rw_raw}" / RT: "{row.rt_raw}"
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-black text-center text-[#1E3A5F] border-r border-slate-200">
                          Desil {row.desil ?? '-'}
                        </td>
                        <td className="p-3 font-bold text-[#1E3A5F] border-r border-slate-200">
                          {row.label_status_bansos}
                        </td>
                        <td className="p-3 border-r border-slate-200">
                          <div className="flex flex-col gap-1">
                            {(row.review_reasons || []).map((reason, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-2.5 py-1 bg-amber-100 border border-amber-400 text-xs font-semibold text-[#1E3A5F]"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => openEditModal(row)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A5F] text-white border-2 border-[#1E3A5F] text-xs font-bold hover:bg-blue-700 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Perbaiki
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSubTab === 'kk' && (
        <div className="bg-white border-4 border-[#1E3A5F] p-6 space-y-4">
          <div>
            <h3 className="text-lg font-black text-[#1E3A5F]">
              Daftar Keluarga dengan Lebih dari Satu Penerima Bantuan ({kkMultiple.length} Keluarga)
            </h3>
            <p className="text-xs text-[#64748B] mt-1">
              Sesuai aturan pemerataan satu Kartu Keluarga satu bantuan, berikut adalah keluarga yang tercatat memiliki lebih dari satu anggota penerima bantuan sosial untuk diperiksa petugas.
            </p>
          </div>

          {kkMultiple.length === 0 ? (
            <div className="p-8 text-center border-2 border-[#1E3A5F] bg-[#FAFAFA] font-bold text-[#64748B]">
              Tidak ditemukan Kartu Keluarga dengan lebih dari satu penerima bantuan.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kkMultiple.slice(0, 100).map((kk, idx) => (
                <div key={idx} className="border-2 border-[#1E3A5F] bg-[#FAFAFA] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b-2 border-[#1E3A5F] pb-2">
                    <div>
                      <span className="text-[11px] font-bold text-[#64748B] block">
                        Nomor Kartu Keluarga (No. KK):
                      </span>
                      <span className="text-xs font-mono font-black text-[#1E3A5F]">
                        {kk.no_kk || kk.no_kk_masked}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 bg-rose-200 border border-[#1E3A5F] text-xs font-black text-[#1E3A5F]">
                      {kk.recipient_count} Anggota Menerima
                    </span>
                  </div>
                  <div className="space-y-2">
                    {kk.members.map((m) => (
                      <div
                        key={m.id_anonim}
                        className="flex items-center justify-between bg-white p-2.5 border border-[#1E3A5F] text-xs"
                      >
                        <div>
                          <strong className="text-[#1E3A5F] block">
                            {m.nama || m.id_anonim}
                          </strong>
                          <span className="text-[11px] text-[#64748B]">
                            NIK: {m.nik || '-'} • RT {m.rt}/RW {m.rw} • Desil {m.desil}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 bg-blue-100 border border-[#1E3A5F] text-[11px] font-bold text-[#1E3A5F]">
                          {m.bansos_raw} ({m.jumlah_program} Program)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'audit' && (
        <div className="bg-white border-4 border-[#1E3A5F] p-6 space-y-4">
          <div>
            <h3 className="text-lg font-black text-[#1E3A5F]">
              Riwayat Perbaikan Data Warga oleh Petugas
            </h3>
            <p className="text-xs text-[#64748B] mt-1">
              Setiap perubahan data warga tercatat secara transparan beserta nama petugas, waktu perbaikan, dan alasannya.
            </p>
          </div>

          {editLogs.length === 0 ? (
            <div className="p-8 text-center border-2 border-[#1E3A5F] bg-[#FAFAFA] font-bold text-[#64748B]">
              Belum ada riwayat perubahan data warga oleh petugas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border-2 border-[#1E3A5F]">
                <thead>
                  <tr className="bg-[#1E3A5F] text-white text-xs font-bold">
                    <th className="p-3 border-r border-white/20">Waktu</th>
                    <th className="p-3 border-r border-white/20">Nama Petugas</th>
                    <th className="p-3 border-r border-white/20">Warga yang Diperbaiki</th>
                    <th className="p-3 border-r border-white/20">Data Sebelumnya</th>
                    <th className="p-3 border-r border-white/20">Data Setelah Diperbaiki</th>
                    <th className="p-3">Alasan Perbaikan</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-200 text-xs">
                  {editLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-[#475569] border-r border-slate-200">
                        {log.created_at}
                      </td>
                      <td className="p-3 font-black text-[#1E3A5F] border-r border-slate-200">
                        {log.edited_by}
                      </td>
                      <td className="p-3 border-r border-slate-200">
                        <strong className="text-[#1E3A5F] block">{log.nama || log.id_anonim}</strong>
                        <span className="text-[11px] font-mono text-[#64748B]">
                          {log.id_anonim} (#{log.excel_row_number})
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-rose-700 border-r border-slate-200">
                        RW: {log.old_values?.rw_raw || '-'}, RT: {log.old_values?.rt_raw || '-'}, Desil:{' '}
                        {log.old_values?.desil}, Bantuan: "{log.old_values?.bansos_raw || 'Kosong'}"
                      </td>
                      <td className="p-3 font-mono text-[11px] text-emerald-700 border-r border-slate-200">
                        RW: {log.new_values?.rw_raw || '-'}, RT: {log.new_values?.rt_raw || '-'}, Desil:{' '}
                        {log.new_values?.desil}, Bantuan: "{log.new_values?.bansos_raw || 'Kosong'}"
                      </td>
                      <td className="p-3 font-semibold text-[#1E3A5F]">{log.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Perbaiki Data Warga */}
      {editingRow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-[#1E3A5F] w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-[#1E3A5F] pb-3">
              <div>
                <h3 className="text-lg font-black text-[#1E3A5F]">
                  Perbaiki Data Warga
                </h3>
                <p className="text-xs font-bold text-[#64748B]">
                  {editingRow.nama || editingRow.id_anonim} • NIK: {editingRow.nik || '-'}
                </p>
              </div>
              <button
                onClick={() => setEditingRow(null)}
                className="p-1 border-2 border-[#1E3A5F] text-[#1E3A5F] hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E3A5F] mb-1">
                    Nomor RW
                  </label>
                  <input
                    type="text"
                    value={formRw}
                    onChange={(e) => setFormRw(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]"
                    placeholder="Contoh: 005"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1E3A5F] mb-1">
                    Nomor RT
                  </label>
                  <input
                    type="text"
                    value={formRt}
                    onChange={(e) => setFormRt(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]"
                    placeholder="Contoh: 001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E3A5F] mb-1">
                    Kelompok Desil (1 - 4)
                  </label>
                  <select
                    value={formDesil}
                    onChange={(e) => setFormDesil(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] bg-white"
                  >
                    <option value={1}>Desil 1 (Sangat Miskin)</option>
                    <option value={2}>Desil 2 (Miskin)</option>
                    <option value={3}>Desil 3 (Hampir Miskin)</option>
                    <option value={4}>Desil 4 (Rentan)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1E3A5F] mb-1">
                    Status Bantuan Sosial
                  </label>
                  <select
                    value={formBansos}
                    onChange={(e) => setFormBansos(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] bg-white"
                  >
                    <option value="">Belum Tercatat (0 Program)</option>
                    <option value="Sembako">Sembako (1 Program)</option>
                    <option value="Sembako,PKH">Sembako & PKH (2 Program)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E3A5F] mb-1">
                  Catatan / Keterangan Domisili
                </label>
                <input
                  type="text"
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]"
                  placeholder="Kosongkan jika warga aktif tinggal di kelurahan..."
                />
              </div>

              <div className="border-t-2 border-slate-200 pt-3 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E3A5F] mb-1">
                    Nama Petugas Pemeriksa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formEditedBy}
                    onChange={(e) => setFormEditedBy(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]"
                    placeholder="Nama petugas kelurahan..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1E3A5F] mb-1">
                    Alasan Perbaikan Data *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]"
                    placeholder="Jelaskan hasil pengecekan lapangan / dokumen KK..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#1E3A5F] text-white border-2 border-[#1E3A5F] text-xs font-bold hover:bg-blue-800"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Menyimpan...' : 'Simpan Perbaikan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
