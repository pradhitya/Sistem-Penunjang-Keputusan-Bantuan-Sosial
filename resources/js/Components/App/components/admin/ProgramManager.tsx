import { useState } from 'react';
import {
  Settings,
  BarChart2,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Inbox,
  Send,
  Info,
} from 'lucide-react';
import { AppData } from '../../data';
import { DataKriteria } from './DataKriteria';
import { HasilSAW } from './HasilSAW';
import { WargaDikecualikan } from './WargaDikecualikan';
import { PerluDicekPetugas } from './PerluDicekPetugas';
import { UjiSensitivitas } from './UjiSensitivitas';
import { InboxSanggahan } from './InboxSanggahan';
import { LogWA } from './LogWA';

interface Props {
  data: AppData;
  setData: (d: AppData) => void;
}

type TabType =
  | 'hasil-topsis'
  | 'kriteria'
  | 'dikecualikan'
  | 'perlu-dicek'
  | 'sensitivitas'
  | 'sanggahan'
  | 'log-wa';

export function ProgramManager({ data, setData }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('hasil-topsis');

  const currentProgram = data.jenisBantuan.find((j) => j.id === data.activeJenisBantuanId);
  const sanggahanBaruCount = (data.sanggahans || []).filter(
    (s) => s.status === 'baru' && s.bantuan_id === data.activeJenisBantuanId
  ).length;

  const tabs: {
    id: TabType;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'hasil-topsis', label: 'HASIL PRIORITAS AHP-TOPSIS', icon: BarChart2 },
    { id: 'kriteria', label: 'KRITERIA & BOBOT AHP', icon: Settings },
    { id: 'dikecualikan', label: 'WARGA DIKECUALIKAN', icon: ShieldAlert },
    { id: 'perlu-dicek', label: 'PERLU DICEK PETUGAS', icon: AlertTriangle },
    { id: 'sensitivitas', label: 'UJI SENSITIVITAS', icon: Activity },
    { id: 'sanggahan', label: 'SANGGAHAN', icon: Inbox, badge: sanggahanBaruCount },
    { id: 'log-wa', label: 'LOG WA', icon: Send },
  ];

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Program Header */}
      <div className="bg-white rounded-none p-6 md:p-8 border-4 border-[#1E3A5F] shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="px-3 py-1.5 rounded-none bg-blue-400 text-[#1E3A5F] border-2 border-[#1E3A5F] text-[10px] font-black tracking-widest uppercase shadow-none">
                METODE AHP-TOPSIS AKTIF
              </span>
              {currentProgram?.periode_evaluasi && (
                <span className="px-3 py-1.5 rounded-none bg-violet-400 text-[#1E3A5F] border-2 border-[#1E3A5F] text-[10px] font-black tracking-widest uppercase shadow-none">
                  {currentProgram.periode_evaluasi}
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-[#1E3A5F] tracking-tight uppercase">
              {currentProgram?.nama_program || 'SPK PRIORITAS BANTUAN SOSIAL KELURAHAN'}
            </h1>
            <p className="text-[#64748B] text-xs font-bold tracking-widest mt-3 uppercase leading-relaxed max-w-3xl">
              {currentProgram?.deskripsi ||
                'Penentuan urutan prioritas calon penerima bantuan sosial kelurahan menggunakan metode AHP-TOPSIS.'}
            </p>
          </div>
        </div>

        <div className="mt-5 p-4 rounded-none border-2 border-[#1E3A5F] bg-amber-200 flex items-center gap-3">
          <Info className="w-5 h-5 text-[#1E3A5F] flex-shrink-0" />
          <p className="text-xs font-black text-[#1E3A5F]">
            Hasil adalah urutan prioritas pendukung keputusan, bukan penetapan layak atau tidak layak.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-[#1E3A5F] p-2 md:p-3 border-4 border-[#1E3A5F] shadow-none flex overflow-x-auto hide-scrollbar gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-none text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${
                isActive
                  ? 'bg-white text-[#1E3A5F] border-[#1E3A5F] shadow-none'
                  : 'bg-[#1E3A5F] text-white border-transparent hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#1E3A5F]' : 'text-slate-300'}`} />
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 ? (
                <span
                  className={`ml-2 w-6 h-6 border-2 border-[#1E3A5F] rounded-none text-[10px] font-black flex items-center justify-center shadow-none ${
                    isActive ? 'bg-amber-400 text-[#1E3A5F]' : 'bg-rose-400 text-white border-white'
                  }`}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'hasil-topsis' && <HasilSAW data={data} setData={setData} />}
        {activeTab === 'kriteria' && <DataKriteria data={data} setData={setData} />}
        {activeTab === 'dikecualikan' && <WargaDikecualikan />}
        {activeTab === 'perlu-dicek' && <PerluDicekPetugas />}
        {activeTab === 'sensitivitas' && <UjiSensitivitas />}
        {activeTab === 'sanggahan' && <InboxSanggahan data={data} setData={setData} />}
        {activeTab === 'log-wa' && <LogWA data={data} setData={setData} />}
      </div>
    </div>
  );
}
