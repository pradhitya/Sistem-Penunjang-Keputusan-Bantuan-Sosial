import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ShieldAlert, Search, Info, RefreshCw, Edit3, X, Save } from 'lucide-react';

interface ExcludedRow {
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
  bansos_raw: string;
  status_bansos: string;
  label_status_bansos: string;
  keterangan_raw: string;
  is_pindah: boolean;
  exclusion_reasons: string[];
}

export function WargaDikecualikan() {
  const [rows, setRows] = useState<ExcludedRow[]>([]);
  const [totalExcluded, setTotalExcluded] = useState(0);
  const [disclaimer, setDisclaimer] = useState(
    'Hasil adalah urutan prioritas pendukung keputusan, bukan penetapan layak atau tidak layak.'
  );
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pindah' | 'rtrw'>('all');
  const [loading, setLoading] = useState(true);

  // Modal Perbaiki Data Warga langsung dari halaman ini
  const [editingRow, setEditingRow] = useState<ExcludedRow | null>(null);
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

  const fetchExcluded = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ahp-topsis/excluded');
      setRows(res.data.rows || []);
      setTotalExcluded(res.data.total_excluded || 0);
      if (res.data.disclaimer) {
        setDisclaimer(res.data.disclaimer);
      }
    } catch (err) {
      console.error('Gagal memuat daftar warga dikecualikan', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExcluded();
  }, []);

  const openEditModal = (row: ExcludedRow) => {
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
      fetchExcluded();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan perubahan data warga.');
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = rows.filter((r) => {
    if (filterType === 'pindah' && !r.is_pindah) return false;
    if (filterType === 'rtrw' && r.rt_rw_valid) return false;

    if (search.trim() !== '') {
      const q = search.toLowerCase();
      const text = [
        r.id_anonim,
        r.nama,
        r.nik,
        r.no_kk,
        r.alamat,
        r.rw_raw,
        r.rt_raw,
        r.bansos_raw,
        r.keterangan_raw,
        ...(r.exclusion_reasons || []),
      ]
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    }
    return true;
  });

  const pindahCount = rows.filter((r) => r.is_pindah).length;
  const invalidRtRwCount = rows.filter((r) => !r.rt_rw_valid).length;

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
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-100 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              Penyaringan Administratif
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[#1E3A5F] tracking-tight">
              Warga Tidak Masuk Perhitungan Prioritas
            </h2>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Data warga di bawah ini tetap tersimpan utuh di dalam sistem, namun belum diikutkan dalam urutan peringkat karena tercatat sudah pindah domisili atau data RT/RW belum lengkap. Jika data RT/RW sudah diverifikasi, Anda dapat langsung memperbaikinya di sini.
            </p>
          </div>
          <button
            onClick={fetchExcluded}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E3A5F] text-white border-2 border-[#1E3A5F] text-xs font-bold hover:bg-slate-800 transition-colors self-start"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
        </div>

        {/* Kartu Ringkasan */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-[#FAFAFA] border-2 border-[#1E3A5F] p-4">
            <p className="text-xs font-bold text-[#64748B]">Total Tidak Masuk Peringkat</p>
            <p className="text-2xl font-black text-[#1E3A5F] mt-1">{totalExcluded} Warga</p>
            <p className="text-xs text-[#64748B] mt-1">Data tetap tersimpan dan tidak dihapus</p>
          </div>
          <div className="bg-rose-50 border-2 border-[#1E3A5F] p-4">
            <p className="text-xs font-bold text-[#1E3A5F]">Warga Pindah Domisili</p>
            <p className="text-2xl font-black text-rose-700 mt-1">{pindahCount} Warga</p>
            <p className="text-xs text-[#64748B] mt-1">Tercatat sudah pindah tempat tinggal</p>
          </div>
          <div className="bg-amber-50 border-2 border-[#1E3A5F] p-4">
            <p className="text-xs font-bold text-[#1E3A5F]">Data RT/RW Belum Sesuai</p>
            <p className="text-2xl font-black text-amber-800 mt-1">{invalidRtRwCount} Warga</p>
            <p className="text-xs text-[#64748B] mt-1">Klik "Perbaiki" jika nomor RT/RW sudah diketahui</p>
          </div>
        </div>
      </div>

      {/* Filter & Pencarian */}
      <div className="bg-white border-4 border-[#1E3A5F] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: `Semua (${rows.length})` },
            { id: 'pindah', label: `Warga Pindah (${pindahCount})` },
            { id: 'rtrw', label: `RT/RW Belum Sesuai (${invalidRtRwCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold border-2 border-[#1E3A5F] transition-colors ${
                filterType === tab.id
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-white text-[#1E3A5F] hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Nama, NIK, Alamat, atau alasan..."
            className="w-full pl-9 pr-4 py-2 bg-[#FAFAFA] border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] focus:outline-none"
          />
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white border-4 border-[#1E3A5F] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1E3A5F] text-white text-xs font-bold">
                <th className="p-3 border-r border-white/20">No. Urut</th>
                <th className="p-3 border-r border-white/20">Nama Lengkap & NIK</th>
                <th className="p-3 border-r border-white/20">Alamat & RT/RW Tercatat</th>
                <th className="p-3 border-r border-white/20 text-center">Desil</th>
                <th className="p-3 border-r border-white/20">Status Bantuan & Catatan</th>
                <th className="p-3 border-r border-white/20">Alasan Tidak Masuk Peringkat</th>
                <th className="p-3 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-200 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center font-bold text-[#1E3A5F]">
                    Memuat daftar warga...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center font-bold text-[#64748B]">
                    Tidak ada data warga yang sesuai pencarian.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id_anonim} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-[#1E3A5F] border-r border-slate-200">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 border border-[#1E3A5F] font-mono">
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
                    </td>
                    <td className="p-3 border-r border-slate-200">
                      <p className="text-xs text-[#1E3A5F] font-medium">{row.alamat || '-'}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-rose-50 border border-rose-300 font-bold text-rose-700 text-[11px]">
                        RW: "{row.rw_raw || '-'}" / RT: "{row.rt_raw || '-'}"
                      </span>
                    </td>
                    <td className="p-3 font-black text-center text-[#1E3A5F] border-r border-slate-200">
                      Desil {row.desil ?? '-'}
                    </td>
                    <td className="p-3 border-r border-slate-200">
                      <p className="font-bold text-[#1E3A5F]">
                        {row.bansos_raw || (
                          <span className="text-[#64748B] font-normal">Belum tercatat</span>
                        )}
                      </p>
                      {row.keterangan_raw && (
                        <p className="text-[11px] text-rose-700 font-semibold mt-0.5">
                          Ket: {row.keterangan_raw}
                        </p>
                      )}
                    </td>
                    <td className="p-3 border-r border-slate-200">
                      <div className="flex flex-col gap-1">
                        {(row.exclusion_reasons || []).map((reason, i) => (
                          <span
                            key={i}
                            className="inline-block px-2.5 py-1 bg-rose-100 border border-rose-400 text-xs font-bold text-rose-900"
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
                  placeholder="Kosongkan jika warga masih tinggal di kelurahan..."
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
                    placeholder="Contoh: Sesuai KK warga berdomisili di RT 002 RW 005..."
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
