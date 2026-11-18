import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Info, RefreshCw, CheckCircle2, TrendingUp } from 'lucide-react';

interface ScenarioItem {
  key: string;
  name: string;
  description: string;
  weights: {
    C1: number;
    C2: number;
    C3: number;
  };
  spearman_correlation: number;
  top_10_overlap_count: number;
  top_10_total_count: number;
  top_10_overlap_percent: number;
  mean_rank_shift: number;
  max_rank_shift: number;
}

interface SensitivityReport {
  total_alternatives: number;
  top_10_cutoff_count: number;
  baseline_weights: {
    C1: number;
    C2: number;
    C3: number;
  };
  scenarios: ScenarioItem[];
}

export function UjiSensitivitas() {
  const [report, setReport] = useState<SensitivityReport | null>(null);
  const [disclaimer, setDisclaimer] = useState(
    'Hasil adalah urutan prioritas pendukung keputusan, bukan penetapan layak atau tidak layak.'
  );
  const [loading, setLoading] = useState(true);

  const fetchSensitivity = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/ahp-topsis/sensitivity');
      setReport(res.data.sensitivity || null);
      if (res.data.disclaimer) {
        setDisclaimer(res.data.disclaimer);
      }
    } catch (err) {
      console.error('Gagal memuat hasil uji sensitivitas', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSensitivity();
  }, []);

  const getStabilityLabel = (rho: number) => {
    if (rho >= 0.95) {
      return { text: 'Sangat Stabil', style: 'bg-emerald-200 text-[#1E3A5F]' };
    }
    if (rho >= 0.85) {
      return { text: 'Cukup Stabil', style: 'bg-amber-200 text-[#1E3A5F]' };
    }
    return { text: 'Banyak Berubah', style: 'bg-rose-200 text-[#1E3A5F]' };
  };

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
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 border-2 border-[#1E3A5F] text-xs font-bold text-[#1E3A5F] mb-2">
              <Activity className="w-3.5 h-3.5" />
              Simulasi & Uji Kestabilan Peringkat
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[#1E3A5F] tracking-tight">
              Uji Sensitivitas (Simulasi Perubahan Bobot)
            </h2>
            <p className="text-sm font-medium text-[#64748B] mt-1 max-w-3xl">
              Halaman ini menguji apakah daftar warga <strong>Prioritas 1 (Sangat Mendesak)</strong> tetap konsisten apabila persentase bobot penilaian diubah-ubah (misalnya bobot dibuat sama rata, hanya menilai Desil saja, atau tiap bobot dinaikkan/diturunkan 20%).
            </p>
          </div>

          <button
            onClick={fetchSensitivity}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1E3A5F] text-white border-2 border-[#1E3A5F] text-xs font-bold hover:bg-slate-800 transition-colors self-start"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Jalankan Ulang Simulasi
          </button>
        </div>

        {report && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-[#FAFAFA] border-2 border-[#1E3A5F] p-4">
              <p className="text-xs font-bold text-[#64748B]">Total Warga yang Diuji</p>
              <p className="text-2xl font-black text-[#1E3A5F] mt-1">
                {report.total_alternatives.toLocaleString('id-ID')} Warga
              </p>
              <p className="text-xs text-[#64748B] mt-1">Seluruh warga yang masuk perhitungan</p>
            </div>
            <div className="bg-blue-50 border-2 border-[#1E3A5F] p-4">
              <p className="text-xs font-bold text-[#1E3A5F]">Jumlah Warga Prioritas 1</p>
              <p className="text-2xl font-black text-blue-800 mt-1">
                {report.top_10_cutoff_count.toLocaleString('id-ID')} Warga
              </p>
              <p className="text-xs text-[#64748B] mt-1">Kelompok paling mendesak (10% teratas)</p>
            </div>
            <div className="bg-emerald-50 border-2 border-[#1E3A5F] p-4">
              <p className="text-xs font-bold text-[#1E3A5F]">Bobot Acuan Saat Ini</p>
              <p className="text-lg font-black text-emerald-900 mt-1">
                Ekonomi {(report.baseline_weights.C1 * 100).toFixed(1)}% • Bantuan{' '}
                {(report.baseline_weights.C2 * 100).toFixed(1)}% • Wilayah{' '}
                {(report.baseline_weights.C3 * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-[#64748B] mt-1">Menjadi pembanding untuk semua simulasi</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabel Skenario Simulasi */}
      <div className="bg-white border-4 border-[#1E3A5F] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1E3A5F] text-white text-xs font-bold">
                <th className="p-3.5 border-r border-white/20">Skenario Simulasi Bobot</th>
                <th className="p-3.5 border-r border-white/20 text-center">Bobot Ekonomi (C1)</th>
                <th className="p-3.5 border-r border-white/20 text-center">Bobot Bantuan (C2)</th>
                <th className="p-3.5 border-r border-white/20 text-center">Bobot Wilayah (C3)</th>
                <th className="p-3.5 border-r border-white/20 text-center">
                  Kemiripan Urutan Peringkat
                </th>
                <th className="p-3.5 border-r border-white/20 text-center">
                  Warga Prioritas 1 yang Tetap Sama
                </th>
                <th className="p-3.5 text-center">Rata-rata Geser Urutan</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-200 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center font-bold text-[#1E3A5F]">
                    Menghitung perbandingan 10 skenario simulasi bobot...
                  </td>
                </tr>
              ) : !report || report.scenarios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center font-bold text-[#64748B]">
                    Data simulasi belum tersedia.
                  </td>
                </tr>
              ) : (
                report.scenarios.map((scen) => {
                  const isBaseline = scen.key === 'baseline';
                  const rho = scen.spearman_correlation;
                  const overlap = scen.top_10_overlap_percent;
                  const stability = getStabilityLabel(rho);

                  return (
                    <tr
                      key={scen.key}
                      className={isBaseline ? 'bg-blue-50/70' : 'hover:bg-slate-50'}
                    >
                      <td className="p-3.5 border-r border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#1E3A5F] text-sm">{scen.name}</span>
                          {isBaseline && (
                            <span className="px-2 py-0.5 bg-[#1E3A5F] text-white text-[10px] font-bold">
                              Acuan Saat Ini
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#64748B] mt-0.5">{scen.description}</p>
                      </td>
                      <td className="p-3.5 text-center font-mono font-black text-[#1E3A5F] border-r border-slate-200">
                        {(scen.weights.C1 * 100).toFixed(1)}%
                      </td>
                      <td className="p-3.5 text-center font-mono font-black text-[#1E3A5F] border-r border-slate-200">
                        {(scen.weights.C2 * 100).toFixed(1)}%
                      </td>
                      <td className="p-3.5 text-center font-mono font-black text-[#1E3A5F] border-r border-slate-200">
                        {(scen.weights.C3 * 100).toFixed(1)}%
                      </td>
                      <td className="p-3.5 text-center border-r border-slate-200">
                        <span
                          className={`inline-block px-2.5 py-1 border border-[#1E3A5F] font-bold text-xs ${stability.style}`}
                        >
                          {stability.text} ({(rho * 100).toFixed(1)}%)
                        </span>
                        <span className="block text-[10px] font-mono text-[#64748B] mt-1">
                          Korelasi Spearman: {rho.toFixed(4)}
                        </span>
                      </td>
                      <td className="p-3.5 text-center border-r border-slate-200">
                        <span
                          className={`inline-block px-2.5 py-1 border border-[#1E3A5F] font-black text-xs ${
                            overlap >= 90
                              ? 'bg-emerald-100 text-[#1E3A5F]'
                              : overlap >= 75
                              ? 'bg-amber-100 text-[#1E3A5F]'
                              : 'bg-rose-100 text-[#1E3A5F]'
                          }`}
                        >
                          {overlap.toFixed(1)}% Sama
                        </span>
                        <span className="block text-[11px] font-medium text-[#64748B] mt-1">
                          {scen.top_10_overlap_count.toLocaleString('id-ID')} dari{' '}
                          {scen.top_10_total_count.toLocaleString('id-ID')} warga
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-[#1E3A5F]">
                        ±{scen.mean_rank_shift.toFixed(0)} urutan
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panduan Membaca Tabel */}
      <div className="bg-white border-4 border-[#1E3A5F] p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-black text-[#1E3A5F]">
              Apa Arti "Kemiripan Urutan Peringkat"?
            </h4>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Semakin mendekati <strong>100% (Korelasi 1,0000)</strong>, berarti urutan prioritas warga sangat kokoh dan tidak mudah berubah meskipun bobot kriteria digeser sedikit.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-black text-[#1E3A5F]">
              Apa Arti "Warga Prioritas 1 yang Tetap Sama"?
            </h4>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Menunjukkan berapa banyak warga di kelompok <strong>Prioritas 1 (Sangat Mendesak)</strong> yang tetap masuk daftar Prioritas 1 walaupun skenario bobotnya diubah.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
