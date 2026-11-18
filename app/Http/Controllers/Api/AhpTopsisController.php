<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\WargaEditLog;
use App\Services\AhpService;
use App\Services\BansosDataParserService;
use App\Services\BansosExcelImportService;
use App\Services\SensitivityAnalysisService;
use App\Services\TopsisService;
use App\Services\XlsxService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AhpTopsisController extends Controller
{
    public const DISCLAIMER_TEXT = 'Hasil adalah urutan prioritas pendukung keputusan, bukan penetapan layak atau tidak layak.';

    public function __construct(
        private readonly AhpService $ahpService,
        private readonly BansosDataParserService $parserService,
        private readonly BansosExcelImportService $importService,
        private readonly TopsisService $topsisService,
        private readonly SensitivityAnalysisService $sensitivityService,
        private readonly XlsxService $xlsxService
    ) {
    }

    /**
     * Ambil konfigurasi aktif dari penyimpanan pengaturan (atau default jika belum ada).
     */
    public function getActiveConfig(): array
    {
        $defaults = TopsisService::getDefaultConfig();
        $defaults['ahp_matrix'] = [
            [1.0, 3.0, 5.0],
            [1.0 / 3.0, 1.0, 3.0],
            [1.0 / 5.0, 1.0 / 3.0, 1.0],
        ];

        try {
            if (Schema::hasTable('settings')) {
                $raw = Setting::where('key', 'ahp_topsis_config')->value('value');
                if ($raw) {
                    $decoded = json_decode($raw, true);
                    if (is_array($decoded)) {
                        $merged = array_replace_recursive($defaults, $decoded);
                        if (isset($decoded['desil_scores']) && is_array($decoded['desil_scores'])) {
                            $merged['desil_scores'] = $decoded['desil_scores'];
                        }
                        if (isset($decoded['program_scores']) && is_array($decoded['program_scores'])) {
                            $merged['program_scores'] = $decoded['program_scores'];
                        }
                        $rtrwEnabled = (bool) ($merged['rtrw_config']['enabled'] ?? true);
                        $merged['normalized_weights'] = $this->topsisService->normalizeActiveWeights(
                            $merged['weights'],
                            $rtrwEnabled
                        );
                        return $merged;
                    }
                }
            }
        } catch (\Throwable) {
            // Fallback ke file JSON jika tabel database belum dimigrasi
        }

        $configFile = storage_path('app/ahp_topsis_config.json');
        if (is_file($configFile)) {
            $decoded = json_decode((string) @file_get_contents($configFile), true);
            if (is_array($decoded)) {
                $merged = array_replace_recursive($defaults, $decoded);
                if (isset($decoded['desil_scores']) && is_array($decoded['desil_scores'])) {
                    $merged['desil_scores'] = $decoded['desil_scores'];
                }
                if (isset($decoded['program_scores']) && is_array($decoded['program_scores'])) {
                    $merged['program_scores'] = $decoded['program_scores'];
                }
                $rtrwEnabled = (bool) ($merged['rtrw_config']['enabled'] ?? true);
                $merged['normalized_weights'] = $this->topsisService->normalizeActiveWeights(
                    $merged['weights'],
                    $rtrwEnabled
                );
                return $merged;
            }
        }

        $defaults['normalized_weights'] = $this->topsisService->normalizeActiveWeights(
            $defaults['weights'],
            (bool) ($defaults['rtrw_config']['enabled'] ?? true)
        );

        return $defaults;
    }

    /**
     * Simpan konfigurasi AHP-TOPSIS.
     */
    private function saveActiveConfig(array $config): void
    {
        $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        @file_put_contents(storage_path('app/ahp_topsis_config.json'), $json);

        try {
            if (Schema::hasTable('settings')) {
                Setting::updateOrCreate(
                    ['key' => 'ahp_topsis_config'],
                    ['value' => $json]
                );
            }
        } catch (\Throwable) {
            // Abaikan jika DB belum siap
        }
    }

    /**
     * Muat dataset mentah dari cache/file-bansos.xlsx dan terapkan perubahan petugas (jika ada),
     * lalu jalankan validasi BansosDataParserService dan perhitungan TopsisService.
     */
    private function loadAndComputeDataset(?array $overrideConfig = null): array
    {
        $config = $overrideConfig ?? $this->getActiveConfig();
        $rtrwEnabled = (bool) ($config['rtrw_config']['enabled'] ?? true);
        $desilScores = $config['desil_scores'] ?? [1 => 4, 2 => 3, 3 => 2, 4 => 1];

        $rawRows = $this->loadRawRowsWithEdits();

        $processed = $this->parserService->processDataset(
            $rawRows,
            $desilScores,
            $rtrwEnabled
        );

        $ranked = $this->topsisService->rankDataset($processed['rows'], $config);

        return [
            'config' => $ranked['config'],
            'summary' => $processed['summary'],
            'kk_multiple_bansos' => $processed['kk_multiple_bansos'],
            'rtrw_calculation' => $ranked['rtrw_calculation'],
            'topsis_meta' => $ranked['topsis_meta'],
            'ranked_rows' => $ranked['ranked_rows'],
            'excluded_rows' => $ranked['excluded_rows'],
            'all_rows' => $ranked['all_rows'],
        ];
    }

    /**
     * Baca baris dasar dari storage/app/bansos_raw_rows.json atau data/file-bansos.xlsx,
     * lalu gabungkan dengan daftar perubahan petugas (overrides) dan samarkan identitas pribadi.
     */
    private function loadRawRowsWithEdits(): array
    {
        $rawCachePath = storage_path('app/bansos_raw_rows.json');
        $xlsxPath = base_path('data/file-bansos.xlsx');

        $baseRows = null;
        if (is_file($rawCachePath)) {
            $cached = json_decode((string) @file_get_contents($rawCachePath), true);
            if (is_array($cached) && count($cached) > 0 && array_key_exists('nama', $cached[0] ?? [])) {
                $baseRows = $cached;
            }
        }

        if ($baseRows === null && is_file($xlsxPath)) {
            $imported = $this->importService->parseExcelFile($xlsxPath);
            $baseRows = array_map(function ($r) {
                return [
                    'seq' => $r['seq'],
                    'excel_row_number' => $r['excel_row_number'],
                    'id_anonim' => $r['id_anonim'],
                    'nik' => $r['nik'] ?? '',
                    'no_kk' => $r['no_kk'] ?? '',
                    'no_pbp' => $r['no_pbp'] ?? '',
                    'nama' => $r['nama'] ?? '',
                    'tanggal_lahir' => $r['tanggal_lahir'] ?? '',
                    'hubungan_keluarga' => $r['hubungan_keluarga'] ?? '',
                    'usia' => $r['usia'] ?? null,
                    'alamat' => $r['alamat'] ?? '',
                    'rw_raw' => $r['rw_raw'] ?? '',
                    'rt_raw' => $r['rt_raw'] ?? '',
                    'desil' => $r['desil'],
                    'bansos_raw' => $r['bansos_raw'] ?? '',
                    'keterangan_raw' => $r['keterangan_raw'] ?? '',
                ];
            }, $imported['rows']);

            @file_put_contents($rawCachePath, json_encode($baseRows, JSON_UNESCAPED_UNICODE));
        }

        if ($baseRows === null) {
            return [];
        }

        // Terapkan overrides dari perubahan petugas jika ada
        $overridesPath = storage_path('app/warga_overrides.json');
        if (is_file($overridesPath)) {
            $overrides = json_decode((string) @file_get_contents($overridesPath), true);
            if (is_array($overrides) && !empty($overrides)) {
                foreach ($baseRows as &$row) {
                    $idAnonim = (string) ($row['id_anonim'] ?? '');
                    if (isset($overrides[$idAnonim]) && is_array($overrides[$idAnonim])) {
                        $ov = $overrides[$idAnonim];
                        foreach (['rw_raw', 'rt_raw', 'desil', 'bansos_raw', 'keterangan_raw'] as $field) {
                            if (array_key_exists($field, $ov)) {
                                $row[$field] = $ov[$field];
                            }
                        }
                    }
                }
                unset($row);
            }
        }

        // Ganti identitas pribadi asli (Nama, NIK, No. KK, No. PBP, Alamat, Tanggal Lahir)
        // dengan data simulasi acak yang konsisten agar privasi warga tetap aman untuk laporan.
        foreach ($baseRows as &$row) {
            $row = $this->pseudonymizeRow($row);
        }
        unset($row);

        return $baseRows;
    }

    /**
     * Hasilkan identitas anonim (dummy 999/0000) yang deterministik dari baris warga asli.
     */
    private function pseudonymizeRow(array $row): array
    {
        $seq = (int) ($row['seq'] ?? 1);
        $seed = abs(crc32('anonim_' . ($row['id_anonim'] ?? $seq)));
        $randCode = str_pad((string) (($seed % 8999) + 1000), 4, '0', STR_PAD_LEFT);
        $row['nama'] = 'Warga Anonim ' . $randCode;

        $nikHash = sprintf('%u%u', abs(crc32('nik_a_' . $seq)), abs(crc32('nik_b_' . $seq)));
        $row['nik'] = '99990000' . substr(str_pad($nikHash, 8, '0'), 0, 8);

        $origKk = (string) ($row['no_kk'] ?? '');
        if ($origKk !== '') {
            $kkHash = sprintf('%u%u', abs(crc32('kk_a_' . $origKk)), abs(crc32('kk_b_' . $origKk)));
            $row['no_kk'] = '00009999' . substr(str_pad($kkHash, 8, '0'), 0, 8);
        }

        if (!empty($row['no_pbp'])) {
            $row['no_pbp'] = 'PBP-0000' . str_pad((string) ($seed % 10000), 4, '0', STR_PAD_LEFT);
        }

        $rwPad = str_pad(preg_replace('/\D/', '', (string) ($row['rw_raw'] ?? '0')) ?: '0', 3, '0', STR_PAD_LEFT);
        $rtPad = str_pad(preg_replace('/\D/', '', (string) ($row['rt_raw'] ?? '0')) ?: '0', 3, '0', STR_PAD_LEFT);
        $row['alamat'] = "Jl. Anonim No. 00, RT {$rtPad}/RW {$rwPad}";
        $row['tanggal_lahir'] = '00-00-0000';

        return $row;
    }

    /**
     * Format satu baris hasil prioritas lengkap beserta data warga (Nama, NIK, No KK, Alamat, Tanggal Lahir, Usia, dll).
     */
    private function formatPrivacySafeResultRow(array $row): array
    {
        return [
            'seq' => $row['seq'],
            'excel_row_number' => $row['excel_row_number'],
            'id_anonim' => $row['id_anonim'],
            'nik' => (string) ($row['nik'] ?? ''),
            'no_kk' => (string) ($row['no_kk'] ?? ''),
            'no_pbp' => (string) ($row['no_pbp'] ?? ''),
            'nama' => (string) ($row['nama'] ?? ''),
            'tanggal_lahir' => (string) ($row['tanggal_lahir'] ?? ''),
            'hubungan_keluarga' => (string) ($row['hubungan_keluarga'] ?? ''),
            'usia' => $row['usia'] ?? null,
            'alamat' => (string) ($row['alamat'] ?? ''),
            'rw' => $row['rw'],
            'rt' => $row['rt'],
            'desil' => $row['desil'],
            'jumlah_program' => $row['jumlah_program'],
            'bansos_raw' => $row['bansos_raw'],
            'status_bansos' => $row['status_bansos'],
            'label_status_bansos' => $row['label_status_bansos'],
            'keterangan_raw' => (string) ($row['keterangan_raw'] ?? ''),
            'skor_desil' => round((float) ($row['skor_desil'] ?? 0.0), 4),
            'skor_bansos' => round((float) ($row['skor_bansos'] ?? 0.0), 4),
            'skor_rtrw' => round((float) ($row['skor_rtrw'] ?? 0.0), 4),
            'proporsi_rtrw_smoothed' => isset($row['proporsi_rtrw_smoothed'])
                ? round((float) $row['proporsi_rtrw_smoothed'], 6)
                : null,
            'd_plus' => isset($row['d_plus']) ? round((float) $row['d_plus'], 8) : null,
            'd_minus' => isset($row['d_minus']) ? round((float) $row['d_minus'], 8) : null,
            'nilai_c' => isset($row['nilai_preferensi']) ? round((float) $row['nilai_preferensi'], 8) : null,
            'nilai_c_rounded' => $row['nilai_preferensi_rounded'] ?? null,
            'peringkat' => $row['peringkat'],
            'persentase_kumulatif' => isset($row['persentase_kumulatif'])
                ? round((float) $row['persentase_kumulatif'], 2)
                : null,
            'kelompok' => $row['kelompok'],
            'kelompok_label' => $row['kelompok_label'],
            'needs_review' => (bool) ($row['needs_review'] ?? false),
            'review_reasons' => $row['review_reasons'] ?? [],
        ];
    }

    /**
     * GET /api/ahp-topsis/overview
     * Ringkasan data, konfigurasi AHP-TOPSIS aktif, statistik Desil & Bansos, dan log audit terbaru.
     */
    public function overview()
    {
        $data = $this->loadAndComputeDataset();
        $allRows = $data['all_rows'];

        // Hitung distribusi Desil vs Status Bansos untuk transparansi analisis masalah data
        $desilBreakdown = [];
        for ($d = 1; $d <= 4; $d++) {
            $desilBreakdown[$d] = [
                'desil' => $d,
                'total' => 0,
                'tidak_tercatat_0' => 0,
                'sembako_1' => 0,
                'sembako_pkh_2' => 0,
                'tidak_valid' => 0,
                'persen_tidak_tercatat' => 0.0,
            ];
        }

        foreach ($allRows as $r) {
            $d = (int) ($r['desil'] ?? 0);
            if (!isset($desilBreakdown[$d])) {
                continue;
            }
            $desilBreakdown[$d]['total']++;
            if (!$r['bansos_valid']) {
                $desilBreakdown[$d]['tidak_valid']++;
            } elseif ($r['jumlah_program'] === 0) {
                $desilBreakdown[$d]['tidak_tercatat_0']++;
            } elseif ($r['jumlah_program'] === 1) {
                $desilBreakdown[$d]['sembako_1']++;
            } elseif ($r['jumlah_program'] === 2) {
                $desilBreakdown[$d]['sembako_pkh_2']++;
            }
        }

        foreach ($desilBreakdown as $d => &$stat) {
            $stat['persen_tidak_tercatat'] = $stat['total'] > 0
                ? round(($stat['tidak_tercatat_0'] / $stat['total']) * 100.0, 2)
                : 0.0;
        }
        unset($stat);

        // Hitung jumlah per kelompok urutan prioritas (10%, 30%, 60%, 100%)
        $groupCounts = [
            '10%' => 0,
            '30%' => 0,
            '60%' => 0,
            '100%' => 0,
        ];
        foreach ($data['ranked_rows'] as $r) {
            $g = $r['kelompok'] ?? '100%';
            if (isset($groupCounts[$g])) {
                $groupCounts[$g]++;
            }
        }

        $ahpMatrix = $data['config']['ahp_matrix'] ?? [
            [1.0, 3.0, 5.0],
            [1.0 / 3.0, 1.0, 3.0],
            [1.0 / 5.0, 1.0 / 3.0, 1.0],
        ];
        $ahpCheck = $this->ahpService->calculate($ahpMatrix);

        return response()->json([
            'disclaimer' => self::DISCLAIMER_TEXT,
            'config' => $data['config'],
            'ahp_verification' => $ahpCheck,
            'summary' => [
                'total_rows' => $data['summary']['total_rows'],
                'eligible_for_ranking_count' => $data['summary']['eligible_for_ranking_count'],
                'excluded_count' => $data['summary']['excluded_count'],
                'needs_review_count' => $data['summary']['needs_review_count'],
                'kk_multiple_bansos_count' => $data['summary']['kk_multiple_bansos_count'],
                'group_counts' => $groupCounts,
            ],
            'desil_breakdown' => array_values($desilBreakdown),
            'rtrw_calculation' => $data['rtrw_calculation'],
            'topsis_meta' => $data['topsis_meta'],
            'edit_logs' => $this->getEditLogs(),
        ]);
    }

    /**
     * GET /api/ahp-topsis/results
     * Daftar hasil urutan prioritas (hanya ID anonim, tanpa NIK/nama/NO_KK/alamat/tanggal lahir).
     */
    public function results(Request $request)
    {
        $data = $this->loadAndComputeDataset();
        $rows = $data['ranked_rows'];

        $search = trim((string) $request->query('search', ''));
        $rwFilter = trim((string) $request->query('rw', ''));
        $rtFilter = trim((string) $request->query('rt', ''));
        $desilFilter = trim((string) $request->query('desil', ''));
        $programFilter = trim((string) $request->query('jumlah_program', ''));
        $kelompokFilter = trim((string) $request->query('kelompok', ''));
        $sortBy = (string) $request->query('sort_by', 'peringkat');
        $sortDir = strtolower((string) $request->query('sort_dir', 'asc')) === 'desc' ? 'desc' : 'asc';
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(500, max(10, (int) $request->query('per_page', 50)));

        // kumpulkan daftar RW unik untuk filter dropdown
        $availableRws = [];
        foreach ($rows as $r) {
            $availableRws[$r['rw']] = true;
        }
        ksort($availableRws);

        // Filter
        $filtered = array_filter($rows, function ($r) use (
            $search,
            $rwFilter,
            $rtFilter,
            $desilFilter,
            $programFilter,
            $kelompokFilter
        ) {
            if ($search !== '') {
                $q = strtolower($search);
                $haystack = strtolower(
                    ($r['id_anonim'] ?? '') . ' ' .
                    ($r['nama'] ?? '') . ' ' .
                    ($r['nik'] ?? '') . ' ' .
                    ($r['no_kk'] ?? '') . ' ' .
                    ($r['alamat'] ?? '') . ' ' .
                    'rw ' . ($r['rw'] ?? '') . ' ' .
                    'rt ' . ($r['rt'] ?? '') . ' ' .
                    ($r['kelompok'] ?? '')
                );
                if (!str_contains($haystack, $q)) {
                    return false;
                }
            }
            if ($rwFilter !== '' && $rwFilter !== 'all' && $r['rw'] !== $rwFilter) {
                return false;
            }
            if ($rtFilter !== '' && $rtFilter !== 'all' && $r['rt'] !== $rtFilter) {
                return false;
            }
            if ($desilFilter !== '' && $desilFilter !== 'all' && (string) $r['desil'] !== $desilFilter) {
                return false;
            }
            if ($programFilter !== '' && $programFilter !== 'all' && (string) $r['jumlah_program'] !== $programFilter) {
                return false;
            }
            if ($kelompokFilter !== '' && $kelompokFilter !== 'all' && $r['kelompok'] !== $kelompokFilter) {
                return false;
            }
            return true;
        });

        $filtered = array_values($filtered);

        // Pengurutan (Sorting)
        $allowedSorts = [
            'peringkat' => 'peringkat',
            'nilai_c' => 'nilai_preferensi_rounded',
            'nama' => 'nama',
            'nik' => 'nik',
            'no_kk' => 'no_kk',
            'usia' => 'usia',
            'desil' => 'desil',
            'jumlah_program' => 'jumlah_program',
            'skor_desil' => 'skor_desil',
            'skor_bansos' => 'skor_bansos',
            'skor_rtrw' => 'skor_rtrw',
            'rw' => 'rw',
            'rt' => 'rt',
            'id_anonim' => 'id_anonim',
        ];
        $sortKey = $allowedSorts[$sortBy] ?? 'peringkat';

        usort($filtered, function ($a, $b) use ($sortKey, $sortDir) {
            $va = $a[$sortKey] ?? 0;
            $vb = $b[$sortKey] ?? 0;
            if ($va === $vb) {
                return ($a['seq'] ?? 0) <=> ($b['seq'] ?? 0);
            }
            $cmp = $va <=> $vb;
            return $sortDir === 'desc' ? -$cmp : $cmp;
        });

        $totalFiltered = count($filtered);
        $totalPages = max(1, (int) ceil($totalFiltered / $perPage));
        $offset = ($page - 1) * $perPage;
        $slice = array_slice($filtered, $offset, $perPage);

        $formattedRows = array_map(fn ($r) => $this->formatPrivacySafeResultRow($r), $slice);

        return response()->json([
            'disclaimer' => self::DISCLAIMER_TEXT,
            'meta' => [
                'total_ranked' => count($rows),
                'total_filtered' => $totalFiltered,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => $totalPages,
                'available_rws' => array_keys($availableRws),
                'weights' => $data['topsis_meta']['weights'],
                'ideal_positive' => $data['topsis_meta']['ideal_positive'],
                'ideal_negative' => $data['topsis_meta']['ideal_negative'],
            ],
            'rows' => $formattedRows,
        ]);
    }

    /**
     * GET /api/ahp-topsis/excluded
     * Daftar warga yang dikecualikan dari pemeringkatan beserta alasannya (privasi terjaga).
     */
    public function excluded(Request $request)
    {
        $data = $this->loadAndComputeDataset();
        $excluded = $data['excluded_rows'];
        $search = trim((string) $request->query('search', ''));

        if ($search !== '') {
            $q = strtolower($search);
            $excluded = array_values(array_filter($excluded, function ($r) use ($q) {
                $reasons = implode(' ', $r['exclusion_reasons'] ?? []);
                $haystack = strtolower(
                    ($r['id_anonim'] ?? '') . ' ' .
                    ($r['nama'] ?? '') . ' ' .
                    ($r['nik'] ?? '') . ' ' .
                    ($r['no_kk'] ?? '') . ' ' .
                    ($r['alamat'] ?? '') . ' ' .
                    ($r['rw_raw'] ?? '') . ' ' .
                    ($r['rt_raw'] ?? '') . ' ' .
                    ($r['bansos_raw'] ?? '') . ' ' .
                    ($r['keterangan_raw'] ?? '') . ' ' .
                    $reasons
                );
                return str_contains($haystack, $q);
            }));
        }

        $formatted = array_map(function ($r) {
            return [
                'seq' => $r['seq'],
                'excel_row_number' => $r['excel_row_number'],
                'id_anonim' => $r['id_anonim'],
                'nama' => (string) ($r['nama'] ?? ''),
                'nik' => (string) ($r['nik'] ?? ''),
                'no_kk' => (string) ($r['no_kk'] ?? ''),
                'alamat' => (string) ($r['alamat'] ?? ''),
                'rw' => $r['rw'],
                'rt' => $r['rt'],
                'rw_raw' => $r['rw_raw'],
                'rt_raw' => $r['rt_raw'],
                'rt_rw_valid' => $r['rt_rw_valid'],
                'desil' => $r['desil'],
                'bansos_raw' => $r['bansos_raw'],
                'status_bansos' => $r['status_bansos'],
                'label_status_bansos' => $r['label_status_bansos'],
                'keterangan_raw' => $r['keterangan_raw'],
                'is_pindah' => $r['is_pindah'],
                'exclusion_reasons' => $r['exclusion_reasons'] ?? [],
            ];
        }, $excluded);

        return response()->json([
            'disclaimer' => self::DISCLAIMER_TEXT,
            'total_excluded' => count($data['excluded_rows']),
            'filtered_count' => count($formatted),
            'rows' => $formatted,
        ]);
    }

    /**
     * GET /api/ahp-topsis/review
     * Halaman "Perlu Dicek Petugas" dengan nomor baris Excel, alasan penandaan,
     * laporan aturan 1 KK > 1 penerima bansos, dan riwayat catatan perubahan petugas.
     */
    public function review(Request $request)
    {
        $data = $this->loadAndComputeDataset();
        $allRows = $data['all_rows'];
        $category = trim((string) $request->query('category', 'all'));
        $search = trim((string) $request->query('search', ''));

        $flaggedRows = array_values(array_filter($allRows, fn ($r) => !empty($r['needs_review'])));

        // Hitung statistik per jenis alasan penandaan
        $reasonBreakdown = [
            'rtrw_invalid' => 0,
            'rtrw_rare' => 0,
            'rw_small' => 0,
            'rt_zero' => 0,
            'pindah_in_bansos' => 0,
            'kk_multiple_bansos' => 0,
        ];

        foreach ($flaggedRows as $r) {
            $reasonsText = implode(' | ', $r['review_reasons'] ?? []);
            if (!$r['rt_rw_valid']) {
                $reasonBreakdown['rtrw_invalid']++;
            }
            if (str_contains($reasonsText, 'Kombinasi RT/RW sangat jarang')) {
                $reasonBreakdown['rtrw_rare']++;
            }
            if (str_contains($reasonsText, 'RW dengan 5 warga atau kurang')) {
                $reasonBreakdown['rw_small']++;
            }
            if (str_contains($reasonsText, 'RT bernilai 0')) {
                $reasonBreakdown['rt_zero']++;
            }
            if (!empty($r['pindah_only_in_bansos'])) {
                $reasonBreakdown['pindah_in_bansos']++;
            }
            if (str_contains($reasonsText, 'Aturan 1 KK 1 Bansos')) {
                $reasonBreakdown['kk_multiple_bansos']++;
            }
        }

        // Filter berdasarkan kategori
        if ($category !== '' && $category !== 'all') {
            $flaggedRows = array_values(array_filter($flaggedRows, function ($r) use ($category) {
                $reasonsText = implode(' | ', $r['review_reasons'] ?? []);
                return match ($category) {
                    'rtrw_invalid' => !$r['rt_rw_valid'],
                    'rtrw_rare' => str_contains($reasonsText, 'Kombinasi RT/RW sangat jarang'),
                    'rw_small' => str_contains($reasonsText, 'RW dengan 5 warga atau kurang'),
                    'rt_zero' => str_contains($reasonsText, 'RT bernilai 0'),
                    'pindah_in_bansos' => !empty($r['pindah_only_in_bansos']),
                    'kk_multiple_bansos' => str_contains($reasonsText, 'Aturan 1 KK 1 Bansos'),
                    default => true,
                };
            }));
        }

        if ($search !== '') {
            $q = strtolower($search);
            $flaggedRows = array_values(array_filter($flaggedRows, function ($r) use ($q) {
                $reasonsText = implode(' ', $r['review_reasons'] ?? []);
                $haystack = strtolower(
                    ($r['id_anonim'] ?? '') . ' ' .
                    ($r['nama'] ?? '') . ' ' .
                    ($r['nik'] ?? '') . ' ' .
                    ($r['no_kk'] ?? '') . ' ' .
                    ($r['alamat'] ?? '') . ' ' .
                    'baris ' . ($r['excel_row_number'] ?? '') . ' ' .
                    ($r['rw_raw'] ?? '') . ' ' .
                    ($r['rt_raw'] ?? '') . ' ' .
                    ($r['bansos_raw'] ?? '') . ' ' .
                    $reasonsText
                );
                return str_contains($haystack, $q);
            }));
        }

        $formattedRows = array_map(function ($r) {
            return [
                'seq' => $r['seq'],
                'excel_row_number' => $r['excel_row_number'],
                'id_anonim' => $r['id_anonim'],
                'nama' => (string) ($r['nama'] ?? ''),
                'nik' => (string) ($r['nik'] ?? ''),
                'no_kk' => (string) ($r['no_kk'] ?? ''),
                'alamat' => (string) ($r['alamat'] ?? ''),
                'rw' => $r['rw'],
                'rt' => $r['rt'],
                'rw_raw' => $r['rw_raw'],
                'rt_raw' => $r['rt_raw'],
                'rt_rw_valid' => $r['rt_rw_valid'],
                'desil' => $r['desil'],
                'jumlah_program' => $r['jumlah_program'],
                'bansos_raw' => $r['bansos_raw'],
                'status_bansos' => $r['status_bansos'],
                'label_status_bansos' => $r['label_status_bansos'],
                'keterangan_raw' => $r['keterangan_raw'],
                'is_excluded' => $r['is_excluded'],
                'exclusion_reasons' => $r['exclusion_reasons'] ?? [],
                'needs_review' => $r['needs_review'],
                'review_reasons' => $r['review_reasons'] ?? [],
                'rw_population' => $r['rw_population'] ?? 0,
                'rt_rw_population' => $r['rt_rw_population'] ?? 0,
                'peringkat' => $r['peringkat'] ?? null,
            ];
        }, $flaggedRows);

        return response()->json([
            'disclaimer' => self::DISCLAIMER_TEXT,
            'total_flagged' => $data['summary']['needs_review_count'],
            'reason_breakdown' => $reasonBreakdown,
            'rows' => $formattedRows,
            'kk_multiple_bansos' => $data['kk_multiple_bansos'],
            'edit_logs' => $this->getEditLogs(),
        ]);
    }

    /**
     * POST /api/ahp-topsis/update-warga
     * Petugas mengubah data warga (RW, RT, Desil, Bansos, Keterangan) dengan kewajiban mencatat:
     * siapa (edited_by), kapan (created_at), dan alasan perubahan (reason).
     * Baris tidak pernah dihapus.
     */
    public function updateWarga(Request $request)
    {
        $validated = $request->validate([
            'id_anonim' => 'required|string',
            'edited_by' => 'required|string|min:2|max:120',
            'reason' => 'required|string|min:5|max:1000',
            'rw_raw' => 'nullable|string|max:120',
            'rt_raw' => 'nullable|string|max:120',
            'desil' => 'required|integer|min:1|max:10',
            'bansos_raw' => 'nullable|string|max:120',
            'keterangan_raw' => 'nullable|string|max:255',
        ]);

        $idAnonim = $validated['id_anonim'];
        $rawRows = $this->loadRawRowsWithEdits();

        $targetRow = null;
        foreach ($rawRows as $r) {
            if (($r['id_anonim'] ?? '') === $idAnonim) {
                $targetRow = $r;
                break;
            }
        }

        if (!$targetRow) {
            return response()->json(['message' => "Warga dengan ID Anonim {$idAnonim} tidak ditemukan."], 404);
        }

        $oldValues = [
            'rw_raw' => (string) ($targetRow['rw_raw'] ?? ''),
            'rt_raw' => (string) ($targetRow['rt_raw'] ?? ''),
            'desil' => (int) ($targetRow['desil'] ?? 0),
            'bansos_raw' => (string) ($targetRow['bansos_raw'] ?? ''),
            'keterangan_raw' => (string) ($targetRow['keterangan_raw'] ?? ''),
        ];

        $newValues = [
            'rw_raw' => trim((string) ($validated['rw_raw'] ?? '')),
            'rt_raw' => trim((string) ($validated['rt_raw'] ?? '')),
            'desil' => (int) $validated['desil'],
            'bansos_raw' => trim((string) ($validated['bansos_raw'] ?? '')),
            'keterangan_raw' => trim((string) ($validated['keterangan_raw'] ?? '')),
        ];

        // Simpan ke overrides
        $overridesPath = storage_path('app/warga_overrides.json');
        $overrides = is_file($overridesPath)
            ? (json_decode((string) @file_get_contents($overridesPath), true) ?: [])
            : [];
        $overrides[$idAnonim] = $newValues;
        @file_put_contents($overridesPath, json_encode($overrides, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        // Catat log perubahan (siapa, kapan, alasan)
        $logEntry = [
            'id' => uniqid('log_', false),
            'id_anonim' => $idAnonim,
            'nama' => (string) ($targetRow['nama'] ?? ''),
            'nik' => (string) ($targetRow['nik'] ?? ''),
            'excel_row_number' => $targetRow['excel_row_number'] ?? null,
            'edited_by' => trim($validated['edited_by']),
            'reason' => trim($validated['reason']),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'created_at' => now()->format('Y-m-d H:i:s'),
        ];

        $this->appendEditLog($logEntry);

        return response()->json([
            'message' => "Perubahan data {$idAnonim} berhasil disimpan dan peringkat AHP-TOPSIS telah diperbarui.",
            'log' => $logEntry,
        ]);
    }

    /**
     * GET /api/ahp-topsis/sensitivity
     * Jalankan uji sensitivitas (bobot sama rata, Desil saja 100%, tanpa RT/RW, dan tiap bobot +/-20%).
     */
    public function sensitivity()
    {
        $config = $this->getActiveConfig();
        $rawRows = $this->loadRawRowsWithEdits();
        $processed = $this->parserService->processDataset(
            $rawRows,
            $config['desil_scores'] ?? [1 => 4, 2 => 3, 3 => 2, 4 => 1],
            true
        );

        $report = $this->sensitivityService->runSensitivityAnalysis($processed['rows'], $config);

        return response()->json([
            'disclaimer' => self::DISCLAIMER_TEXT,
            'sensitivity' => $report,
        ]);
    }

    /**
     * POST /api/ahp-topsis/config
     * Simpan perubahan bobot kriteria, tabel skor sub-kriteria, dan opsi kriteria RT/RW.
     * Bobot selalu dinormalkan agar jumlahnya = 1.
     */
    public function updateConfig(Request $request)
    {
        if ($request->boolean('reset_default')) {
            $defaults = TopsisService::getDefaultConfig();
            $defaults['ahp_matrix'] = [
                [1.0, 3.0, 5.0],
                [1.0 / 3.0, 1.0, 3.0],
                [1.0 / 5.0, 1.0 / 3.0, 1.0],
            ];
            $defaults['normalized_weights'] = $this->topsisService->normalizeActiveWeights($defaults['weights'], true);
            $this->saveActiveConfig($defaults);

            return response()->json([
                'message' => 'Konfigurasi AHP-TOPSIS berhasil dikembalikan ke pengaturan awal.',
                'config' => $defaults,
            ]);
        }

        $current = $this->getActiveConfig();

        if ($request->has('weights') && is_array($request->input('weights'))) {
            $w = $request->input('weights');
            $current['weights'] = [
                'C1' => max(0.0, (float) ($w['C1'] ?? $current['weights']['C1'])),
                'C2' => max(0.0, (float) ($w['C2'] ?? $current['weights']['C2'])),
                'C3' => max(0.0, (float) ($w['C3'] ?? $current['weights']['C3'])),
            ];
        }

        if ($request->has('desil_scores') && is_array($request->input('desil_scores'))) {
            $ds = [];
            foreach ($request->input('desil_scores') as $k => $v) {
                if (is_numeric($k) && is_numeric($v)) {
                    $ds[(int) $k] = (float) $v;
                }
            }
            if (!empty($ds)) {
                $current['desil_scores'] = $ds;
            }
        }

        if ($request->has('program_scores') && is_array($request->input('program_scores'))) {
            $ps = [];
            foreach ($request->input('program_scores') as $k => $v) {
                if (is_numeric($k) && is_numeric($v)) {
                    $ps[(int) $k] = (float) $v;
                }
            }
            if (!empty($ps)) {
                $current['program_scores'] = $ps;
            }
        }

        if ($request->has('rtrw_config') && is_array($request->input('rtrw_config'))) {
            $rc = $request->input('rtrw_config');
            if (array_key_exists('enabled', $rc)) {
                $current['rtrw_config']['enabled'] = (bool) $rc['enabled'];
            }
            if (isset($rc['smoothing_m']) && is_numeric($rc['smoothing_m'])) {
                $current['rtrw_config']['smoothing_m'] = max(0.0, (float) $rc['smoothing_m']);
            }
            if (isset($rc['mapping_mode']) && in_array($rc['mapping_mode'], ['direct', 'minmax'], true)) {
                $current['rtrw_config']['mapping_mode'] = $rc['mapping_mode'];
            }
        }

        if ($request->has('ahp_matrix') && is_array($request->input('ahp_matrix'))) {
            $current['ahp_matrix'] = $request->input('ahp_matrix');
        }

        $rtrwEnabled = (bool) ($current['rtrw_config']['enabled'] ?? true);
        $current['normalized_weights'] = $this->topsisService->normalizeActiveWeights($current['weights'], $rtrwEnabled);

        $this->saveActiveConfig($current);

        return response()->json([
            'message' => 'Konfigurasi bobot, tabel skor, dan parameter kriteria berhasil disimpan.',
            'config' => $current,
        ]);
    }

    /**
     * POST /api/ahp-topsis/verify-ahp
     * Verifikasi matriks perbandingan berpasangan 3x3 menggunakan metode AHP.
     */
    public function verifyAhp(Request $request)
    {
        $matrix = $request->input('matrix');
        if (!is_array($matrix) || count($matrix) !== 3) {
            return response()->json(['message' => 'Matriks perbandingan berpasangan harus berukuran 3x3.'], 422);
        }

        try {
            $result = $this->ahpService->calculate($matrix);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if ($request->boolean('apply_weights')) {
            $useColumnAvg = $request->boolean('use_column_average', false);
            $chosen = $useColumnAvg ? $result['column_average_weights'] : $result['weights'];

            $config = $this->getActiveConfig();
            $config['ahp_matrix'] = $matrix;
            $config['weights'] = [
                'C1' => round($chosen[0], 6),
                'C2' => round($chosen[1], 6),
                'C3' => round($chosen[2], 6),
            ];
            $config['normalized_weights'] = $this->topsisService->normalizeActiveWeights(
                $config['weights'],
                (bool) ($config['rtrw_config']['enabled'] ?? true)
            );
            $this->saveActiveConfig($config);
        }

        return response()->json($result);
    }

    /**
     * POST /api/ahp-topsis/import-xlsx
     * Impor file Excel (.xlsx) baru atau muat ulang dari data/file-bansos.xlsx.
     */
    public function importXlsx(Request $request)
    {
        $targetPath = base_path('data/file-bansos.xlsx');
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            if (!is_dir(dirname($targetPath))) {
                @mkdir(dirname($targetPath), 0775, true);
            }
            @copy($file->getRealPath(), $targetPath);
        }

        // Hapus cache mentah hanya jika file sumber Excel tersedia untuk dibaca ulang
        $rawCachePath = storage_path('app/bansos_raw_rows.json');
        if (is_file($rawCachePath) && is_file($targetPath)) {
            @unlink($rawCachePath);
        }

        if ($request->boolean('clear_overrides')) {
            $overridesPath = storage_path('app/warga_overrides.json');
            if (is_file($overridesPath)) {
                @unlink($overridesPath);
            }
        }

        $data = $this->loadAndComputeDataset();

        return response()->json([
            'message' => sprintf(
                'Berhasil memuat %d baris data warga (%d masuk pemeringkatan, %d dikecualikan, %d ditandai untuk dicek petugas).',
                $data['summary']['total_rows'],
                $data['summary']['eligible_for_ranking_count'],
                $data['summary']['excluded_count'],
                $data['summary']['needs_review_count']
            ),
            'summary' => $data['summary'],
        ]);
    }

    /**
     * GET /api/ahp-topsis/export-xlsx
     * Ekspor hasil urutan prioritas AHP-TOPSIS ke file Excel (.xlsx).
     * PRIVASI: TIDAK menampilkan NIK, nama, NO_KK, tanggal lahir, atau alamat!
     */
    public function exportXlsx(Request $request)
    {
        $data = $this->loadAndComputeDataset();
        $rows = $data['ranked_rows'];

        $headers = [
            'Peringkat',
            'ID Warga',
            'Nama Lengkap',
            'NIK',
            'No. KK',
            'No. PBP',
            'Tanggal Lahir',
            'Hubungan Keluarga',
            'Usia',
            'Alamat',
            'RW',
            'RT',
            'Desil',
            'Jumlah Program',
            'Status Bantuan',
            'Skor Desil (C1)',
            'Skor Pemerataan Bantuan (C2)',
            'Skor Wilayah RT/RW (C3)',
            'Nilai Preferensi (C)',
            'Persentase Kumulatif (%)',
            'Kelompok Prioritas',
            'Keterangan Pendukung Keputusan',
        ];

        $exportRows = [];
        foreach ($rows as $r) {
            $exportRows[] = [
                (int) $r['peringkat'],
                (string) $r['id_anonim'],
                (string) ($r['nama'] ?? ''),
                (string) ($r['nik'] ?? ''),
                (string) ($r['no_kk'] ?? ''),
                (string) ($r['no_pbp'] ?? ''),
                (string) ($r['tanggal_lahir'] ?? ''),
                (string) ($r['hubungan_keluarga'] ?? ''),
                (string) ($r['usia'] ?? ''),
                (string) ($r['alamat'] ?? ''),
                (string) $r['rw'],
                (string) $r['rt'],
                (int) $r['desil'],
                (int) $r['jumlah_program'],
                (string) $r['label_status_bansos'],
                round((float) ($r['skor_desil'] ?? 0.0), 4),
                round((float) ($r['skor_bansos'] ?? 0.0), 4),
                round((float) ($r['skor_rtrw'] ?? 0.0), 4),
                round((float) ($r['nilai_preferensi'] ?? 0.0), 8),
                round((float) ($r['persentase_kumulatif'] ?? 0.0), 2),
                (string) $r['kelompok'],
                self::DISCLAIMER_TEXT,
            ];
        }

        $binary = $this->xlsxService->generateXlsx($headers, $exportRows, 'peringkat_lengkap');
        $filename = 'Hasil_Prioritas_AHP_TOPSIS_' . date('Ymd_His') . '.xlsx';

        return response($binary, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    /**
     * Ambil daftar riwayat perubahan data warga oleh petugas.
     */
    private function getEditLogs(): array
    {
        $logFile = storage_path('app/warga_edit_logs.json');
        if (is_file($logFile)) {
            $logs = json_decode((string) @file_get_contents($logFile), true);
            if (is_array($logs)) {
                return $logs;
            }
        }
        return [];
    }

    /**
     * Tambahkan entri baru ke catatan alasan perubahan data warga (siapa, kapan, alasan).
     */
    private function appendEditLog(array $entry): void
    {
        $logs = $this->getEditLogs();
        array_unshift($logs, $entry);
        @file_put_contents(
            storage_path('app/warga_edit_logs.json'),
            json_encode($logs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        try {
            if (Schema::hasTable('warga_edit_logs')) {
                $m = \App\Models\Masyarakat::where('id_anonim', $entry['id_anonim'])->first();
                if ($m) {
                    WargaEditLog::create([
                        'masyarakat_id' => $m->id,
                        'id_anonim' => $entry['id_anonim'],
                        'excel_row_number' => $entry['excel_row_number'],
                        'edited_by' => $entry['edited_by'],
                        'reason' => $entry['reason'],
                        'old_values' => $entry['old_values'],
                        'new_values' => $entry['new_values'],
                    ]);
                }
            }
        } catch (\Throwable) {
            // Abaikan jika baris belum disinkronkan ke tabel masyarakats
        }
    }
}
