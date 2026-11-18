import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Sliders,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Info,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AppData } from '../../data';

interface Props {
  data?: AppData;
  setData?: (d: AppData) => void;
}

export function DataKriteria(_props: Props) {
  const [weights, setWeights] = useState({ C1: 0.633, C2: 0.261, C3: 0.106 });
  const [desilScores, setDesilScores] = useState<Record<string, number>>({
    1: 4,
    2: 3,
    3: 2,
    4: 1,
  });
  const [programScores, setProgramScores] = useState<Record<string, number>>({
    0: 3,
    1: 2,
    2: 1,
  });
  const [rtrwEnabled, setRtrwEnabled] = useState(true);
  const [smoothingM, setSmoothingM] = useState(20);
  const [rtrwStats, setRtrwStats] = useState<{
    p0: number;
    m: number;
    total_n: number;
    combination_count: number;
  } | null>(null);

  // Matriks perbandingan berpasangan AHP 3x3
  const [ahpMatrix, setAhpMatrix] = useState<number[][]>([
    [1, 3, 5],
    [1 / 3, 1, 3],
    [1 / 5, 1 / 3, 1],
  ]);
  const [ahpResult, setAhpResult] = useState<{
    weights: number[];
    column_average_weights: number[];
    lambda_max: number;
    ci: number;
    ri: number;
    cr: number;
    is_consistent: boolean;
    warning: string | null;
  } | null>(null);

  const [showAhpCalculator, setShowAhpCalculator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ahp-topsis/overview');
      const cfg = res.data.config;
      if (cfg) {
        setWeights(cfg.weights || { C1: 0.633, C2: 0.261, C3: 0.106 });
        setDesilScores(cfg.desil_scores || { 1: 4, 2: 3, 3: 2, 4: 1 });
        setProgramScores(cfg.program_scores || { 0: 3, 1: 2, 2: 1 });
        setRtrwEnabled(cfg.rtrw_config?.enabled ?? true);
        setSmoothingM(cfg.rtrw_config?.smoothing_m ?? 20);
        if (cfg.ahp_matrix) {
          setAhpMatrix(cfg.ahp_matrix);
        }
      }
      if (res.data.ahp_verification) {
        setAhpResult(res.data.ahp_verification);
      }
      if (res.data.rtrw_calculation) {
        setRtrwStats(res.data.rtrw_calculation);
      }
    } catch (err) {
      console.error('Gagal memuat pengaturan kriteria', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  // Hitung preview bobot ternormalisasi secara otomatis agar total = 100%
  const previewNormalized = (() => {
    const w1 = Math.max(0, Number(weights.C1) || 0);
    const w2 = Math.max(0, Number(weights.C2) || 0);
    const w3 = rtrwEnabled ? Math.max(0, Number(weights.C3) || 0) : 0;
    const sum = w1 + w2 + w3;
    if (sum <= 0) {
      return rtrwEnabled ? { C1: 1 / 3, C2: 1 / 3, C3: 1 / 3 } : { C1: 0.5, C2: 0.5, C3: 0 };
    }
    return { C1: w1 / sum, C2: w2 / sum, C3: w3 / sum };
  })();

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await axios.post('/api/ahp-topsis/config', {
        weights,
        desil_scores: desilScores,
        program_scores: programScores,
        rtrw_config: {
          enabled: rtrwEnabled,
          smoothing_m: smoothingM,
        },
        ahp_matrix: ahpMatrix,
      });
      toast.success(res.data.message || 'Pengaturan kriteria dan bobot berhasil disimpan.');
      fetchOverview();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan pengaturan kriteria.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = async () => {
    setSaving(true);
    try {
      const res = await axios.post('/api/ahp-topsis/config', { reset_default: true });
      toast.success(res.data.message || 'Pengaturan dikembalikan ke standar awal.');
      fetchOverview();
    } catch (err: any) {
      toast.error('Gagal mengembalikan pengaturan awal.');
    } finally {
      setSaving(false);
    }
  };

  const handleMatrixChange = (r: number, c: number, valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return;
    const next = ahpMatrix.map((row) => [...row]);
    next[r][c] = val;
    if (r !== c) {
      next[c][r] = Number((1 / val).toFixed(6));
    } else {
      next[r][c] = 1;
    }
    setAhpMatrix(next);
  };

  const handleVerifyAhp = async (applyWeights = false, useColumnAverage = false) => {
    try {
      const res = await axios.post('/api/ahp-topsis/verify-ahp', {
        matrix: ahpMatrix,
        apply_weights: applyWeights,
        use_column_average: useColumnAverage,
      });
      setAhpResult(res.data);
      if (applyWeights) {
        const chosen = useColumnAverage ? res.data.column_average_weights : res.data.weights;
        setWeights({
          C1: Number(chosen[0].toFixed(6)),
          C2: Number(chosen[1].toFixed(6)),
          C3: Number(chosen[2].toFixed(6)),
        });
        toast.success('Bobot baru berhasil diterapkan ke kriteria.');
        fetchOverview();
      } else {
        toast.success('Konsistensi perbandingan berhasil dihitung.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menghitung perbandingan kriteria.');
    }
  };

  if (loading) {
    return (
      <div className="bg-white border-4 border-[#1E3A5F] p-10 text-center font-bold text-[#1E3A5F]">
        Memuat pengaturan kriteria dan bobot penilaian...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Catatan Penting */}
      <div className="bg-amber-200 border-4 border-[#1E3A5F] p-4 flex items-center gap-3">
        <Info className="w-5 h-5 text-[#1E3A5F] flex-shrink-0" />
        <p className="text-sm font-bold text-[#1E3A5F]">
          Hasil adalah urutan prioritas pendukung keputusan, bukan penetapan layak atau tidak layak.
        </p>
      </div>

      {/* Header */}
      <div className="bg-white border-4 border-[#1E3A5F] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] mb-2">
              <Sliders className="w-3.5 h-3.5" />
              Pengaturan Penilaian Prioritas
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[#1E3A5F] tracking-tight">
              Kriteria & Bobot Penilaian Bantuan Sosial
            </h2>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Atur seberapa besar pengaruh kondisi ekonomi (Desil), status penerimaan bantuan, dan kondisi wilayah RT/RW dalam menentukan urutan prioritas warga.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleResetDefault}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Kembalikan Standar Awal
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A5F] text-white border-2 border-[#1E3A5F] text-xs font-black hover:bg-blue-900 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>

      {/* Bagian 1: Kriteria & Bobot Prioritas */}
      <div className="bg-white border-4 border-[#1E3A5F] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-black text-[#1E3A5F]">
              1. Bobot Tiga Kriteria Utama
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Sistem otomatis menyesuaikan persentase bobot agar total keseluruhan selalu <strong>100%</strong>.
            </p>
          </div>
          <span className="px-3 py-1 bg-emerald-200 border-2 border-[#1E3A5F] text-xs font-black text-[#1E3A5F]">
            Total Persentase Bobot: 100%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* C1: Desil */}
          <div className="border-2 border-[#1E3A5F] bg-[#FAFAFA] p-4 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-[#1E3A5F] text-white text-xs font-black">
                  Kriteria 1 (C1)
                </span>
                <span className="text-xs font-bold text-emerald-700">Aktif</span>
              </div>
              <h4 className="text-base font-black text-[#1E3A5F] mt-2">
                Kondisi Ekonomi (Desil)
              </h4>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Menilai tingkat kesejahteraan keluarga (Desil 1 s/d 4). Semakin rendah angka Desil, semakin tinggi prioritasnya.
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#475569]">Nilai Bobot:</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={weights.C1}
                  onChange={(e) => setWeights({ ...weights, C1: parseFloat(e.target.value) || 0 })}
                  className="w-24 px-2 py-1 border-2 border-[#1E3A5F] font-mono font-black text-center text-[#1E3A5F] bg-white"
                />
              </div>
              <div className="w-full h-2.5 bg-slate-200 border border-[#1E3A5F] overflow-hidden">
                <div
                  className="h-full bg-blue-600"
                  style={{ width: `${Math.min(100, previewNormalized.C1 * 100)}%` }}
                />
              </div>
              <p className="text-right text-xs font-black text-[#1E3A5F]">
                Pengaruh: {(previewNormalized.C1 * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* C2: Pemerataan Bansos */}
          <div className="border-2 border-[#1E3A5F] bg-[#FAFAFA] p-4 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-[#1E3A5F] text-white text-xs font-black">
                  Kriteria 2 (C2)
                </span>
                <span className="text-xs font-bold text-emerald-700">Aktif</span>
              </div>
              <h4 className="text-base font-black text-[#1E3A5F] mt-2">
                Pemerataan Bantuan Sosial
              </h4>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Menggabungkan program Sembako & PKH (0, 1, atau 2 bantuan). Warga yang belum tercatat menerima bantuan diberi prioritas lebih tinggi.
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#475569]">Nilai Bobot:</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={weights.C2}
                  onChange={(e) => setWeights({ ...weights, C2: parseFloat(e.target.value) || 0 })}
                  className="w-24 px-2 py-1 border-2 border-[#1E3A5F] font-mono font-black text-center text-[#1E3A5F] bg-white"
                />
              </div>
              <div className="w-full h-2.5 bg-slate-200 border border-[#1E3A5F] overflow-hidden">
                <div
                  className="h-full bg-emerald-600"
                  style={{ width: `${Math.min(100, previewNormalized.C2 * 100)}%` }}
                />
              </div>
              <p className="text-right text-xs font-black text-[#1E3A5F]">
                Pengaruh: {(previewNormalized.C2 * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* C3: Prioritas Wilayah RT/RW */}
          <div
            className={`border-2 border-[#1E3A5F] p-4 flex flex-col justify-between space-y-4 ${
              rtrwEnabled ? 'bg-[#FAFAFA]' : 'bg-slate-100 opacity-75'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-[#1E3A5F] text-white text-xs font-black">
                  Kriteria 3 (C3)
                </span>
                <button
                  type="button"
                  onClick={() => setRtrwEnabled(!rtrwEnabled)}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 border border-[#1E3A5F] text-xs font-bold ${
                    rtrwEnabled ? 'bg-emerald-300 text-[#1E3A5F]' : 'bg-rose-200 text-[#1E3A5F]'
                  }`}
                >
                  {rtrwEnabled ? (
                    <>
                      <ToggleRight className="w-4 h-4" /> Aktif
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4" /> Nonaktif
                    </>
                  )}
                </button>
              </div>
              <h4 className="text-base font-black text-[#1E3A5F] mt-2">
                Kondisi Wilayah RT/RW
              </h4>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Membedakan urutan warga di Desil yang sama berdasarkan kepadatan warga miskin (Desil 1 & 2) di lingkungan RT/RW tempat tinggalnya.
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#475569]">Nilai Bobot:</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  disabled={!rtrwEnabled}
                  value={weights.C3}
                  onChange={(e) => setWeights({ ...weights, C3: parseFloat(e.target.value) || 0 })}
                  className="w-24 px-2 py-1 border-2 border-[#1E3A5F] font-mono font-black text-center text-[#1E3A5F] bg-white disabled:bg-slate-200"
                />
              </div>
              <div className="w-full h-2.5 bg-slate-200 border border-[#1E3A5F] overflow-hidden">
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${Math.min(100, previewNormalized.C3 * 100)}%` }}
                />
              </div>
              <p className="text-right text-xs font-black text-[#1E3A5F]">
                Pengaruh: {(previewNormalized.C3 * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bagian 2: Poin Penilaian Tiap Kriteria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Poin Desil */}
        <div className="bg-white border-4 border-[#1E3A5F] p-5 space-y-4">
          <div>
            <h4 className="text-sm font-black text-[#1E3A5F]">
              Poin Kelompok Ekonomi (Desil)
            </h4>
            <p className="text-xs text-[#64748B] mt-0.5">
              Poin lebih besar diberikan kepada warga yang lebih membutuhkan.
            </p>
          </div>
          <div className="space-y-2.5 border-t-2 border-slate-100 pt-3">
            {[
              { d: 1, label: 'Desil 1 (Sangat Miskin)' },
              { d: 2, label: 'Desil 2 (Miskin)' },
              { d: 3, label: 'Desil 3 (Hampir Miskin)' },
              { d: 4, label: 'Desil 4 (Rentan)' },
            ].map((item) => (
              <div
                key={item.d}
                className="flex items-center justify-between bg-[#FAFAFA] p-2.5 border-2 border-[#1E3A5F]"
              >
                <span className="text-xs font-bold text-[#1E3A5F]">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#64748B]">Poin:</span>
                  <input
                    type="number"
                    step="0.5"
                    value={desilScores[item.d] ?? 0}
                    onChange={(e) =>
                      setDesilScores({ ...desilScores, [item.d]: parseFloat(e.target.value) || 0 })
                    }
                    className="w-16 px-2 py-1 border-2 border-[#1E3A5F] font-mono font-black text-center text-xs text-[#1E3A5F] bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Poin Status Bantuan */}
        <div className="bg-white border-4 border-[#1E3A5F] p-5 space-y-4">
          <div>
            <h4 className="text-sm font-black text-[#1E3A5F]">
              Poin Pemerataan Bantuan
            </h4>
            <p className="text-xs text-[#64748B] mt-0.5">
              Warga yang belum tercatat menerima bantuan mendapat poin tertinggi.
            </p>
          </div>
          <div className="space-y-2.5 border-t-2 border-slate-100 pt-3">
            {[
              { prog: 0, label: 'Belum Tercatat (0 Program)' },
              { prog: 1, label: 'Menerima Sembako (1 Program)' },
              { prog: 2, label: 'Sembako & PKH (2 Program)' },
            ].map((item) => (
              <div
                key={item.prog}
                className="flex items-center justify-between bg-[#FAFAFA] p-2.5 border-2 border-[#1E3A5F]"
              >
                <span className="text-xs font-bold text-[#1E3A5F]">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#64748B]">Poin:</span>
                  <input
                    type="number"
                    step="0.5"
                    value={programScores[item.prog] ?? 0}
                    onChange={(e) =>
                      setProgramScores({
                        ...programScores,
                        [item.prog]: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-16 px-2 py-1 border-2 border-[#1E3A5F] font-mono font-black text-center text-xs text-[#1E3A5F] bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pengaturan Wilayah RT/RW */}
        <div className="bg-white border-4 border-[#1E3A5F] p-5 space-y-4">
          <div>
            <h4 className="text-sm font-black text-[#1E3A5F]">
              Pengaturan Wilayah RT/RW
            </h4>
            <p className="text-xs text-[#64748B] mt-0.5">
              Menjaga agar RT yang jumlah warganya sangat sedikit tidak menghasilkan skor yang timpang.
            </p>
          </div>
          <div className="bg-[#FAFAFA] p-3.5 border-2 border-[#1E3A5F] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#1E3A5F] block">
                  Angka Penyeimbang Wilayah (m)
                </span>
                <span className="text-[11px] text-[#64748B]">Standar disarankan: 20</span>
              </div>
              <input
                type="number"
                step="1"
                min="0"
                value={smoothingM}
                onChange={(e) => setSmoothingM(parseFloat(e.target.value) || 0)}
                className="w-20 px-2 py-1 border-2 border-[#1E3A5F] font-mono font-black text-center text-xs text-[#1E3A5F] bg-white"
              />
            </div>
            {rtrwStats && (
              <div className="text-xs text-[#1E3A5F] space-y-1.5 pt-3 border-t border-slate-300">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Rata-rata Warga Desil 1 & 2 Kelurahan:</span>
                  <strong className="font-mono">{(rtrwStats.p0 * 100).toFixed(1)}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Jumlah RT/RW Terdata Valid:</span>
                  <strong className="font-mono">{rtrwStats.combination_count} Wilayah</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bagian 3: Kalkulator Perbandingan Kriteria (AHP) — Dapat Dibuka/Tutup */}
      <div className="bg-white border-4 border-[#1E3A5F] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAhpCalculator(!showAhpCalculator)}
          className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-200 border-2 border-[#1E3A5F] flex items-center justify-center">
              <Calculator className="w-5 h-5 text-[#1E3A5F]" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#1E3A5F]">
                Kalkulator Perbandingan Kriteria (Metode AHP)
              </h3>
              <p className="text-xs text-[#64748B]">
                Digunakan untuk menghitung bobot kriteria secara otomatis dari tabel perbandingan tingkat kepentingan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1E3A5F]">
            <span>{showAhpCalculator ? 'Sembunyikan' : 'Tampilkan Kalkulator'}</span>
            {showAhpCalculator ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAhpCalculator && (
          <div className="p-6 border-t-2 border-[#1E3A5F] space-y-5 bg-[#FAFAFA]">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleVerifyAhp(false, false)}
                className="px-4 py-2 bg-white text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-bold hover:bg-slate-100"
              >
                Cek Konsistensi Tabel
              </button>
              <button
                type="button"
                onClick={() => handleVerifyAhp(true, false)}
                className="px-4 py-2 bg-violet-300 text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-bold hover:bg-violet-200"
              >
                Gunakan Bobot Hasil AHP
              </button>
              <button
                type="button"
                onClick={() => handleVerifyAhp(true, true)}
                className="px-4 py-2 bg-emerald-300 text-[#1E3A5F] border-2 border-[#1E3A5F] text-xs font-bold hover:bg-emerald-200"
              >
                Gunakan Bobot Standar (63,3% / 26,1% / 10,6%)
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Tabel Perbandingan 3x3 */}
              <div className="overflow-x-auto bg-white border-2 border-[#1E3A5F]">
                <table className="w-full text-center border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#1E3A5F] text-white font-bold">
                      <th className="p-2.5 border-r border-white/20 text-left">Kriteria</th>
                      <th className="p-2.5 border-r border-white/20">Kondisi Ekonomi (C1)</th>
                      <th className="p-2.5 border-r border-white/20">Pemerataan Bantuan (C2)</th>
                      <th className="p-2.5">Wilayah RT/RW (C3)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {['Kondisi Ekonomi (C1)', 'Pemerataan Bantuan (C2)', 'Wilayah RT/RW (C3)'].map(
                      (rowLabel, rIdx) => (
                        <tr key={rIdx}>
                          <td className="p-2.5 font-bold text-[#1E3A5F] bg-slate-50 border-r border-slate-200 text-left">
                            {rowLabel}
                          </td>
                          {[0, 1, 2].map((cIdx) => (
                            <td key={cIdx} className="p-2 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                disabled={rIdx === cIdx}
                                value={Number(ahpMatrix[rIdx]?.[cIdx] ?? 1).toFixed(3)}
                                onChange={(e) => handleMatrixChange(rIdx, cIdx, e.target.value)}
                                className="w-24 px-2 py-1 border-2 border-[#1E3A5F] font-mono font-bold text-center text-xs text-[#1E3A5F] disabled:bg-slate-200"
                              />
                            </td>
                          ))}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* Hasil Konsistensi */}
              {ahpResult && (
                <div className="space-y-3">
                  {ahpResult.warning ? (
                    <div className="p-4 bg-rose-200 border-2 border-[#1E3A5F] flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-[#1E3A5F] flex-shrink-0" />
                      <div className="text-xs text-[#1E3A5F]">
                        <strong className="block">Perbandingan Kurang Konsisten</strong>
                        <span>{ahpResult.warning}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-200 border-2 border-[#1E3A5F] flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#1E3A5F] flex-shrink-0" />
                      <div className="text-xs text-[#1E3A5F]">
                        <strong className="block">Perbandingan Kriteria Konsisten (Valid)</strong>
                        <span>
                          Tingkat Konsistensi (CR) = <strong>{ahpResult.cr.toFixed(4)}</strong> (di bawah batas maksimum 0,10)
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-white border-2 border-[#1E3A5F] text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Hasil Bobot Eigenvektor:</span>
                      <strong className="font-mono text-[#1E3A5F]">
                        {ahpResult.weights.map((w) => `${(w * 100).toFixed(1)}%`).join(' / ')}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Hasil Rata-rata Kolom:</span>
                      <strong className="font-mono text-[#1E3A5F]">
                        {ahpResult.column_average_weights.map((w) => `${(w * 100).toFixed(1)}%`).join(' / ')}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
