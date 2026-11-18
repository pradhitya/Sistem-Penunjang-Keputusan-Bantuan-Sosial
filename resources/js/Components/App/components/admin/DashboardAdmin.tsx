import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Users,
  Award,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Sliders,
  Upload,
  Download,
  RefreshCw,
  Info,
  CheckCircle2,
  ArrowRight,
  History,
} from 'lucide-react';
import { AppData } from '../../data';

interface Props {
  data: AppData;
  onNavigate?: (page: string) => void;
}

interface DesilStat {
  desil: number;
  total: number;
  tidak_tercatat_0: number;
  sembako_1: number;
  sembako_pkh_2: number;
  tidak_valid: number;
  persen_tidak_tercatat: number;
}

interface OverviewResponse {
  disclaimer: string;
  config: {
    weights: { C1: number; C2: number; C3: number };
    normalized_weights: { C1: number; C2: number; C3: number };
    desil_scores: Record<string, number>;
    program_scores: Record<string, number>;
    rtrw_config: {
      enabled: boolean;
      smoothing_m: number;
      mapping_mode: string;
    };
  };
  ahp_verification: {
    weights: number[];
    column_average_weights: number[];
    lambda_max: number;
    ci: number;
    ri: number;
    cr: number;
    is_consistent: boolean;
    warning: string | null;
  };
  summary: {
    total_rows: number;
    eligible_for_ranking_count: number;
    excluded_count: number;
    needs_review_count: number;
    kk_multiple_bansos_count: number;
    group_counts: Record<string, number>;
  };
  desil_breakdown: DesilStat[];
  rtrw_calculation: {
    p0: number;
    m: number;
    total_n: number;
    total_target_desil: number;
    combination_count: number;
  };
  topsis_meta: {
    weights: Record<string, number>;
    ideal_positive: Record<string, number>;
    ideal_negative: Record<string, number>;
    total_ranked: number;
    total_excluded: number;
  };
  edit_logs: {
    id: string;
    id_anonim: string;
    excel_row_number: number | null;
    edited_by: string;
    reason: string;
    created_at: string;
  }[];
}

export function DashboardAdmin({ onNavigate }: Props) {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ahp-topsis/overview');
      setOverview(res.data);
    } catch (err) {
      console.error('Gagal memuat ringkasan dashboard', err);
      toast.error('Gagal memuat ringkasan data.');
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
      toast.success(res.data.message || 'Data warga berhasil diperbarui.');
      fetchOverview();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal mengimpor data.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleExport = () => {
    window.open('/api/ahp-topsis/export-xlsx', '_blank');
  };

  if (loading && !overview) {
    return (
      <div className="bg-white border-4 border-[#1E3A5F] p-12 text-center font-bold text-[#1E3A5F]">
        Memuat ringkasan data warga...
      </div>
    );
  }

  const summary = overview?.summary;
  const normWeights = overview?.config?.normalized_weights || { C1: 0.633, C2: 0.261, C3: 0.106 };
  const ahp = overview?.ahp_verification;
  const rtrw = overview?.rtrw_calculation;
  const desilRows = overview?.desil_breakdown || [];

  const totalTidakTercatat = desilRows.reduce((acc, r) => acc + r.tidak_tercatat_0, 0);
  const totalSembako = desilRows.reduce((acc, r) => acc + r.sembako_1, 0);
  const totalSembakoPkh = desilRows.reduce((acc, r) => acc + r.sembako_pkh_2, 0);
  const totalWarga = summary?.total_rows || 0;
  const persenTotalTidakTercatat =
    totalWarga > 0 ? ((totalTidakTercatat / totalWarga) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6 pb-10">
      {/* Teks Tetap Wajib */}
      <div className="bg-amber-200 border-4 border-[#1E3A5F] px-4 py-3 flex items-center gap-3">
        <Info className="w-5 h-5 text-[#1E3A5F] flex-shrink-0" />
        <p className="text-xs sm:text-sm font-bold text-[#1E3A5F]">
          {overview?.disclaimer ||
            'Hasil adalah urutan prioritas pendukung keputusan, bukan penetapan layak atau tidak layak.'}
        </p>
      </div>

      {/* Header Ringkas */}
      <div className="bg-white border-4 border-[#1E3A5F] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#1E3A5F] tracking-tight">
            Ringkasan Prioritas Bantuan Sosial
          </h2>
          <p className="text-sm text-[#64748B] mt-1">
            Gambaran umum data warga kelurahan dan urutan prioritas penerima bantuan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-bold hover:bg-slate-100 transition-colors">
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Memproses...' : 'Perbarui Data'}</span>
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleUploadData}
              disabled={uploading}
            />
          </label>

          <button
            onClick={fetchOverview}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-bold hover:bg-slate-100 transition-colors"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-400 text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-black hover:bg-emerald-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            Unduh Hasil
          </button>
        </div>
      </div>

      {/* 4 Kartu Angka Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-4 border-[#1E3A5F] p-5">
          <div className="flex items-center justify-between text-[#64748B] mb-2">
            <span className="text-xs font-bold">Total Warga Terdata</span>
            <Users className="w-5 h-5 text-[#1E3A5F]" />
          </div>
          <p className="text-3xl font-black text-[#1E3A5F]">
            {(summary?.total_rows || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-[#64748B] mt-2">Seluruh data tersimpan utuh</p>
        </div>

        <button
          onClick={() => onNavigate?.('hasil-topsis')}
          className="text-left bg-emerald-50 border-4 border-[#1E3A5F] p-5 hover:bg-emerald-100 transition-colors group"
        >
          <div className="flex items-center justify-between text-emerald-900 mb-2">
            <span className="text-xs font-bold">Masuk Pemeringkatan</span>
            <Award className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-[#1E3A5F]">
            {(summary?.eligible_for_ranking_count || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-xs font-bold text-[#1E3A5F] mt-2 flex items-center gap-1">
            Lihat daftar peringkat <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </p>
        </button>

        <button
          onClick={() => onNavigate?.('warga-dikecualikan')}
          className="text-left bg-rose-50 border-4 border-[#1E3A5F] p-5 hover:bg-rose-100 transition-colors group"
        >
          <div className="flex items-center justify-between text-rose-900 mb-2">
            <span className="text-xs font-bold">Tidak Diikutkan</span>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-rose-800">
            {(summary?.excluded_count || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-xs font-bold text-[#1E3A5F] mt-2 flex items-center gap-1">
            Warga pindah & data belum valid <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </p>
        </button>

        <button
          onClick={() => onNavigate?.('perlu-dicek-petugas')}
          className="text-left bg-amber-50 border-4 border-[#1E3A5F] p-5 hover:bg-amber-100 transition-colors group"
        >
          <div className="flex items-center justify-between text-amber-900 mb-2">
            <span className="text-xs font-bold">Perlu Dicek Petugas</span>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-amber-900">
            {(summary?.needs_review_count || 0).toLocaleString('id-ID')}
          </p>
          <p className="text-xs font-bold text-[#1E3A5F] mt-2 flex items-center gap-1">
            Termasuk {summary?.kk_multiple_bansos_count || 0} KK ganda <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </p>
        </button>
      </div>

      {/* Pembagian Kelompok Prioritas */}
      <div className="bg-white border-4 border-[#1E3A5F] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-black text-[#1E3A5F]">
              Pembagian Kelompok Urutan Prioritas
            </h3>
            <p className="text-xs text-[#64748B]">
              Warga dikelompokkan berdasarkan urutan peringkat dari yang paling diprioritaskan.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              code: '10%',
              title: 'Prioritas 1 (Sangat Mendesak)',
              badge: 'Tahap 1',
              desc: 'Didahulukan pada kuota bantuan pertama',
              color: 'bg-emerald-300',
            },
            {
              code: '30%',
              title: 'Prioritas 2 (Mendesak)',
              badge: 'Tahap 2',
              desc: 'Diusulkan setelah Prioritas 1 terpenuhi',
              color: 'bg-blue-200',
            },
            {
              code: '60%',
              title: 'Prioritas 3 (Cukup Mendesak)',
              badge: 'Cadangan',
              desc: 'Daftar cadangan jika masih ada sisa kuota',
              color: 'bg-amber-200',
            },
            {
              code: '100%',
              title: 'Prioritas 4 (Prioritas Rendah)',
              badge: 'Terakhir',
              desc: 'Sudah menerima bantuan / ekonomi lebih baik',
              color: 'bg-slate-200',
            },
          ].map((g) => (
            <div key={g.code} className="bg-[#FAFAFA] border-2 border-[#1E3A5F] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#1E3A5F]">{g.title}</span>
                <span
                  className={`px-2 py-0.5 border border-[#1E3A5F] text-[11px] font-black text-[#1E3A5F] ${g.color}`}
                >
                  {g.badge}
                </span>
              </div>
              <p className="text-2xl font-black text-[#1E3A5F]">
                {(summary?.group_counts?.[g.code] || 0).toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-[#64748B]">warga</span>
              </p>
              <p className="text-xs text-[#64748B] mt-1">{g.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Grid Utama: Kondisi Penerimaan Bansos per Desil & Bobot Kriteria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabel Ringkas per Desil */}
        <div className="lg:col-span-2 bg-white border-4 border-[#1E3A5F] p-6 space-y-4">
          <div>
            <h3 className="text-base font-black text-[#1E3A5F]">
              Kondisi Penerimaan Bansos Berdasarkan Desil
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Perbandingan jumlah warga yang belum tercatat menerima bantuan vs yang sudah menerima.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border-2 border-[#1E3A5F]">
              <thead>
                <tr className="bg-[#1E3A5F] text-white text-xs font-bold">
                  <th className="p-3 border-r border-white/20">Kelompok Ekonomi</th>
                  <th className="p-3 border-r border-white/20 text-center">Jumlah Warga</th>
                  <th className="p-3 border-r border-white/20 text-center">Belum Tercatat (0)</th>
                  <th className="p-3 border-r border-white/20 text-center">Sembako (1)</th>
                  <th className="p-3 border-r border-white/20 text-center">Sembako + PKH (2)</th>
                  <th className="p-3">Proporsi Belum Tercatat</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#1E3A5F] text-xs">
                {desilRows.map((row) => (
                  <tr key={row.desil} className="hover:bg-slate-50">
                    <td className="p-3 font-black text-[#1E3A5F] border-r-2 border-[#1E3A5F]">
                      Desil {row.desil}
                    </td>
                    <td className="p-3 text-center font-bold text-[#1E3A5F] border-r-2 border-[#1E3A5F]">
                      {row.total.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-center text-[#1E3A5F] border-r-2 border-[#1E3A5F]">
                      {row.tidak_tercatat_0.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-center text-[#1E3A5F] border-r-2 border-[#1E3A5F]">
                      {row.sembako_1.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-center text-[#1E3A5F] border-r-2 border-[#1E3A5F]">
                      {row.sembako_pkh_2.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-slate-200 border border-[#1E3A5F]">
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${Math.min(100, row.persen_tidak_tercatat)}%` }}
                          />
                        </div>
                        <span className="font-bold text-[#1E3A5F] w-12 text-right">
                          {row.persen_tidak_tercatat.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-black text-[#1E3A5F]">
                  <td className="p-3 border-r-2 border-[#1E3A5F]">Total Keseluruhan</td>
                  <td className="p-3 text-center border-r-2 border-[#1E3A5F]">
                    {totalWarga.toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 text-center border-r-2 border-[#1E3A5F]">
                    {totalTidakTercatat.toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 text-center border-r-2 border-[#1E3A5F]">
                    {totalSembako.toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 text-center border-r-2 border-[#1E3A5F]">
                    {totalSembakoPkh.toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 text-right">{persenTotalTidakTercatat}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel Bobot Kriteria */}
        <div className="bg-white border-4 border-[#1E3A5F] p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-[#1E3A5F]">Bobot Penilaian</h3>
                <p className="text-xs text-[#64748B]">Porsi pengaruh tiap kriteria</p>
              </div>
              {ahp?.is_consistent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-200 border border-[#1E3A5F] text-xs font-bold text-[#1E3A5F]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Konsisten
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-[#FAFAFA] border-2 border-[#1E3A5F]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#1E3A5F]">1. Tingkat Desil (Ekonomi)</span>
                  <span className="font-black text-sm text-[#1E3A5F]">
                    {(normWeights.C1 * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-[#64748B]">Desil 1 mendapat prioritas tertinggi</p>
              </div>

              <div className="p-3.5 bg-[#FAFAFA] border-2 border-[#1E3A5F]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#1E3A5F]">2. Pemerataan Bantuan</span>
                  <span className="font-black text-sm text-[#1E3A5F]">
                    {(normWeights.C2 * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-[#64748B]">Warga yang belum tercatat menerima didahulukan</p>
              </div>

              <div className="p-3.5 bg-[#FAFAFA] border-2 border-[#1E3A5F]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#1E3A5F]">3. Kondisi Wilayah RT/RW</span>
                  <span className="font-black text-sm text-[#1E3A5F]">
                    {(normWeights.C3 * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-[#64748B]">
                  Memperhatikan kepadatan warga Desil 1 & 2 di {rtrw?.combination_count ?? 0} RT/RW
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => onNavigate?.('kriteria-ahp')}
              className="w-full py-2.5 px-4 bg-[#1E3A5F] text-white border-2 border-[#1E3A5F] text-xs font-bold hover:bg-blue-900 transition-colors flex items-center justify-center gap-2"
            >
              <Sliders className="w-4 h-4" />
              Atur Bobot & Skor Kriteria
            </button>
            <button
              onClick={() => onNavigate?.('uji-sensitivitas')}
              className="w-full py-2.5 px-4 bg-white text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Cek Uji Sensitivitas
            </button>
          </div>
        </div>
      </div>

      {/* Riwayat Perubahan Data oleh Petugas */}
      {overview?.edit_logs && overview.edit_logs.length > 0 && (
        <div className="bg-white border-4 border-[#1E3A5F] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#1E3A5F]" />
              <h3 className="text-base font-black text-[#1E3A5F]">
                Riwayat Perbaikan Data Terakhir
              </h3>
            </div>
            <button
              onClick={() => onNavigate?.('perlu-dicek-petugas')}
              className="text-xs font-bold text-[#1E3A5F] underline"
            >
              Lihat semua
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border-2 border-[#1E3A5F] text-xs">
              <thead>
                <tr className="bg-[#1E3A5F] text-white font-bold">
                  <th className="p-2.5 border-r border-white/20">Waktu</th>
                  <th className="p-2.5 border-r border-white/20">Petugas</th>
                  <th className="p-2.5 border-r border-white/20">ID Warga</th>
                  <th className="p-2.5">Alasan Perbaikan</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#1E3A5F]">
                {overview.edit_logs.slice(0, 5).map((log) => (
                  <tr key={log.id}>
                    <td className="p-2.5 text-[#1E3A5F] border-r-2 border-[#1E3A5F]">
                      {log.created_at}
                    </td>
                    <td className="p-2.5 font-bold text-[#1E3A5F] border-r-2 border-[#1E3A5F]">
                      {log.edited_by}
                    </td>
                    <td className="p-2.5 font-bold text-[#1E3A5F] border-r-2 border-[#1E3A5F]">
                      {log.id_anonim}
                    </td>
                    <td className="p-2.5 text-[#1E3A5F]">{log.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
