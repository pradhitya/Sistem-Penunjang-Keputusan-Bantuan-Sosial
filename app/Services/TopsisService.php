<?php

namespace App\Services;

use InvalidArgumentException;

class TopsisService
{
    /**
     * Konfigurasi default AHP-TOPSIS (seluruhnya dapat diubah lewat pengaturan/database)
     */
    public static function getDefaultConfig(): array
    {
        return [
            'weights' => [
                'C1' => 0.633, // Desil
                'C2' => 0.261, // Status pemerataan bansos (jumlah program 0..2)
                'C3' => 0.106, // Prioritas RT/RW
            ],
            'criteria_types' => [
                'C1' => 'benefit',
                'C2' => 'benefit',
                'C3' => 'benefit',
            ],
            'desil_scores' => [
                1 => 4.0,
                2 => 3.0,
                3 => 2.0,
                4 => 1.0,
            ],
            'program_scores' => [
                0 => 3.0,
                1 => 2.0,
                2 => 1.0,
            ],
            'rtrw_config' => [
                'enabled' => true,
                'smoothing_m' => 20.0,
                'target_desils' => [1, 2],
                'scale_min' => 1.0,
                'scale_max' => 4.0,
                'mapping_mode' => 'direct', // 'direct': 1 + 3*p, atau 'minmax': 1 + 3*(p - p_min)/(p_max - p_min)
            ],
            'group_thresholds' => [
                ['max_percent' => 10.0, 'code' => '10%', 'label' => 'Prioritas 1 (<= 10%)'],
                ['max_percent' => 30.0, 'code' => '30%', 'label' => 'Prioritas 2 (10% - 30%)'],
                ['max_percent' => 60.0, 'code' => '60%', 'label' => 'Prioritas 3 (30% - 60%)'],
                ['max_percent' => 100.0, 'code' => '100%', 'label' => 'Prioritas 4 (60% - 100%)'],
            ],
        ];
    }

    /**
     * Normalkan bobot kriteria aktif agar jumlahnya tepat 1.0.
     * Jika kriteria C3 (RT/RW) dimatikan, bobot C3 menjadi 0 dan bobot lain dinormalkan ulang.
     *
     * @param array<string, float|int> $weights
     * @param bool $rtrwEnabled
     * @return array<string, float>
     */
    public function normalizeActiveWeights(array $weights, bool $rtrwEnabled = true): array
    {
        $active = [
            'C1' => max(0.0, (float) ($weights['C1'] ?? 0.633)),
            'C2' => max(0.0, (float) ($weights['C2'] ?? 0.261)),
            'C3' => $rtrwEnabled ? max(0.0, (float) ($weights['C3'] ?? 0.106)) : 0.0,
        ];

        $sum = array_sum($active);
        if ($sum <= 0.0) {
            if ($rtrwEnabled) {
                return ['C1' => 1.0 / 3.0, 'C2' => 1.0 / 3.0, 'C3' => 1.0 / 3.0];
            }
            return ['C1' => 0.5, 'C2' => 0.5, 'C3' => 0.0];
        }

        return [
            'C1' => $active['C1'] / $sum,
            'C2' => $active['C2'] / $sum,
            'C3' => $active['C3'] / $sum,
        ];
    }

    /**
     * Hitung skor Prioritas RT/RW (C3):
     * Proporsi warga Desil 1 dan 2 pada tiap kombinasi RT/RW, dihaluskan:
     *   p = (jumlah_desil_1_2 + m * p0) / (n + m)
     * dengan m = 20 (default), p0 = proporsi keseluruhan warga Desil 1 dan 2,
     * lalu dipetakan linear ke skala [scale_min, scale_max] (default 1 sampai 4).
     *
     * @param array<int, array<string, mixed>> $eligibleRows Baris warga yang valid untuk perhitungan proporsi
     * @param array<string, mixed> $rtrwConfig Konfigurasi RT/RW
     * @return array{
     *     p0: float,
     *     m: float,
     *     total_n: int,
     *     total_target_desil: int,
     *     stats_by_rtrw: array<string, array{
     *         rw: string,
     *         rt: string,
     *         n: int,
     *         jumlah_desil_1_2: int,
     *         raw_proportion: float,
     *         smoothed_p: float,
     *         score: float
     *     }>
     * }
     */
    public function computeRtRwScores(array $eligibleRows, array $rtrwConfig = []): array
    {
        $defaults = self::getDefaultConfig()['rtrw_config'];
        $cfg = array_merge($defaults, $rtrwConfig);

        $m = (float) ($cfg['smoothing_m'] ?? 20.0);
        $targetDesils = array_map('intval', $cfg['target_desils'] ?? [1, 2]);
        $scaleMin = (float) ($cfg['scale_min'] ?? 1.0);
        $scaleMax = (float) ($cfg['scale_max'] ?? 4.0);
        $mappingMode = (string) ($cfg['mapping_mode'] ?? 'direct');

        $totalN = 0;
        $totalTarget = 0;
        $groups = [];

        foreach ($eligibleRows as $row) {
            $rtRwValid = (bool) ($row['rt_rw_valid'] ?? true);
            if (!$rtRwValid) {
                continue;
            }

            $rw = (string) ($row['rw'] ?? '');
            $rt = (string) ($row['rt'] ?? '');
            $key = $rw . '/' . $rt;
            $desil = (int) ($row['desil'] ?? 0);
            $isTarget = in_array($desil, $targetDesils, true);

            $totalN++;
            if ($isTarget) {
                $totalTarget++;
            }

            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'rw' => $rw,
                    'rt' => $rt,
                    'n' => 0,
                    'jumlah_desil_1_2' => 0,
                ];
            }
            $groups[$key]['n']++;
            if ($isTarget) {
                $groups[$key]['jumlah_desil_1_2']++;
            }
        }

        $p0 = $totalN > 0 ? ($totalTarget / $totalN) : 0.0;

        $pMin = INF;
        $pMax = -INF;

        foreach ($groups as $key => &$g) {
            $n = $g['n'];
            $k = $g['jumlah_desil_1_2'];
            $rawP = $n > 0 ? ($k / $n) : 0.0;
            $smoothedP = ($n + $m) > 0 ? (($k + $m * $p0) / ($n + $m)) : $p0;

            $g['raw_proportion'] = $rawP;
            $g['smoothed_p'] = $smoothedP;

            if ($smoothedP < $pMin) {
                $pMin = $smoothedP;
            }
            if ($smoothedP > $pMax) {
                $pMax = $smoothedP;
            }
        }
        unset($g);

        $span = $scaleMax - $scaleMin;
        foreach ($groups as $key => &$g) {
            $p = $g['smoothed_p'];
            if ($mappingMode === 'minmax') {
                if ($pMax > $pMin) {
                    $g['score'] = $scaleMin + $span * (($p - $pMin) / ($pMax - $pMin));
                } else {
                    $g['score'] = $scaleMin + ($span / 2.0);
                }
            } else {
                // Pemetaan linear proporsi [0, 1] -> [scale_min, scale_max], misal 1 + 3 * p
                $g['score'] = $scaleMin + $span * $p;
            }
        }
        unset($g);

        return [
            'p0' => $p0,
            'm' => $m,
            'total_n' => $totalN,
            'total_target_desil' => $totalTarget,
            'p_min' => is_infinite($pMin) ? 0.0 : $pMin,
            'p_max' => is_infinite($pMax) ? 0.0 : $pMax,
            'mapping_mode' => $mappingMode,
            'stats_by_rtrw' => $groups,
        ];
    }

    /**
     * Hitung TOPSIS murni pada matriks keputusan X (alternatif x kriteria).
     * Dapat dipanggil langsung untuk unit test maupun dari pipeline data warga.
     *
     * @param array<int|string, array<string, float|int>> $decisionMatrix Matriks X [id => ['C1' => x1, 'C2' => x2, ...]]
     * @param array<string, float|int> $weights Bobot kriteria ['C1' => w1, 'C2' => w2, ...]
     * @param array<string, string> $criteriaTypes Tipe kriteria ['C1' => 'benefit', ...]
     * @param array<int, array{max_percent: float, code: string, label: string}>|null $groupThresholds
     * @return array{
     *     weights: array<string, float>,
     *     divisors: array<string, float>,
     *     ideal_positive: array<string, float>,
     *     ideal_negative: array<string, float>,
     *     results: array<int|string, array{
     *         scores: array<string, float>,
     *         normalized: array<string, float>,
     *         weighted: array<string, float>,
     *         d_plus: float,
     *         d_minus: float,
     *         preference_c: float,
     *         preference_c_rounded: float,
     *         rank: int,
     *         cumulative_percent: float,
     *         group_code: string,
     *         group_label: string
     *     }>
     * }
     */
    public function calculateMatrix(
        array $decisionMatrix,
        array $weights,
        array $criteriaTypes = [],
        ?array $groupThresholds = null
    ): array {
        if (empty($decisionMatrix)) {
            return [
                'weights' => [],
                'divisors' => [],
                'ideal_positive' => [],
                'ideal_negative' => [],
                'results' => [],
            ];
        }

        // Ambil daftar kode kriteria yang memiliki bobot > 0
        $activeWeights = [];
        $weightSum = 0.0;
        foreach ($weights as $code => $w) {
            $val = max(0.0, (float) $w);
            if ($val > 0.0) {
                $activeWeights[$code] = $val;
                $weightSum += $val;
            }
        }

        if ($weightSum <= 0.0) {
            throw new InvalidArgumentException('Total bobot kriteria aktif harus lebih besar dari 0.');
        }

        foreach ($activeWeights as $code => $val) {
            $activeWeights[$code] = $val / $weightSum;
        }

        $criteriaCodes = array_keys($activeWeights);

        // 1. Hitung pembagi normalisasi vektor: sqrt(sum_i x_ij^2)
        $divisors = [];
        foreach ($criteriaCodes as $code) {
            $sumSq = 0.0;
            foreach ($decisionMatrix as $row) {
                $x = (float) ($row[$code] ?? 0.0);
                $sumSq += $x * $x;
            }
            $divisors[$code] = sqrt($sumSq);
        }

        // 2 & 3. Normalisasi vektor r_ij dan matriks terbobot v_ij = w_j * r_ij
        $results = [];
        $idealPositive = [];
        $idealNegative = [];

        foreach ($criteriaCodes as $code) {
            $idealPositive[$code] = -INF;
            $idealNegative[$code] = INF;
        }

        foreach ($decisionMatrix as $altId => $row) {
            $scores = [];
            $normalized = [];
            $weighted = [];

            foreach ($criteriaCodes as $code) {
                $x = (float) ($row[$code] ?? 0.0);
                $div = $divisors[$code];
                $r = $div > 0.0 ? ($x / $div) : 0.0;
                $v = $activeWeights[$code] * $r;

                $scores[$code] = $x;
                $normalized[$code] = $r;
                $weighted[$code] = $v;

                $type = strtolower((string) ($criteriaTypes[$code] ?? 'benefit'));
                if ($type === 'cost') {
                    if ($v < $idealPositive[$code] || is_infinite($idealPositive[$code])) {
                        $idealPositive[$code] = $idealPositive[$code] === -INF ? $v : min($idealPositive[$code], $v);
                    }
                    if ($v > $idealNegative[$code] || is_infinite($idealNegative[$code])) {
                        $idealNegative[$code] = $idealNegative[$code] === INF ? $v : max($idealNegative[$code], $v);
                    }
                } else {
                    // Benefit: A+ = max(v), A- = min(v)
                    if ($v > $idealPositive[$code]) {
                        $idealPositive[$code] = $v;
                    }
                    if ($v < $idealNegative[$code]) {
                        $idealNegative[$code] = $v;
                    }
                }
            }

            $results[$altId] = [
                'scores' => $scores,
                'normalized' => $normalized,
                'weighted' => $weighted,
                'd_plus' => 0.0,
                'd_minus' => 0.0,
                'preference_c' => 0.5,
                'preference_c_rounded' => 0.5,
                'rank' => 1,
                'cumulative_percent' => 100.0,
                'group_code' => '100%',
                'group_label' => 'Prioritas 4 (60% - 100%)',
            ];
        }

        // 4 & 5 & 6. Hitung jarak D+_i, D-_i, dan nilai preferensi C_i = D-_i / (D+_i + D-_i)
        foreach ($results as $altId => &$res) {
            $sumSqPlus = 0.0;
            $sumSqMinus = 0.0;

            foreach ($criteriaCodes as $code) {
                $v = $res['weighted'][$code];
                $diffPlus = $v - $idealPositive[$code];
                $diffMinus = $v - $idealNegative[$code];
                $sumSqPlus += $diffPlus * $diffPlus;
                $sumSqMinus += $diffMinus * $diffMinus;
            }

            $dPlus = sqrt($sumSqPlus);
            $dMinus = sqrt($sumSqMinus);
            $denom = $dPlus + $dMinus;

            // Jika pembagi 0, C = 0,5
            $c = $denom > 0.0 ? ($dMinus / $denom) : 0.5;
            $cRounded = round($c, 10);

            $res['d_plus'] = $dPlus;
            $res['d_minus'] = $dMinus;
            $res['preference_c'] = $c;
            $res['preference_c_rounded'] = $cRounded;
        }
        unset($res);

        // 7. Peringkat: C menurun, metode "min" untuk nilai kembar (bulatkan C ke 10 desimal sebelum membandingkan)
        $sortedKeys = array_keys($results);
        usort($sortedKeys, function ($a, $b) use ($results) {
            $ca = $results[$a]['preference_c_rounded'];
            $cb = $results[$b]['preference_c_rounded'];
            if ($ca === $cb) {
                return $a <=> $b;
            }
            return $cb <=> $ca; // Descending
        });

        $totalAlternatives = count($sortedKeys);
        $thresholds = $groupThresholds ?? self::getDefaultConfig()['group_thresholds'];

        $currentRank = 1;
        $prevCRounded = null;

        foreach ($sortedKeys as $posIndex => $altId) {
            $cRounded = $results[$altId]['preference_c_rounded'];
            if ($posIndex === 0) {
                $currentRank = 1;
            } elseif ($cRounded < $prevCRounded) {
                // Metode "min": peringkat adalah posisi (1-based) dari kemunculan pertama nilai tersebut
                $currentRank = $posIndex + 1;
            }
            $prevCRounded = $cRounded;

            $cumPercent = $totalAlternatives > 0 ? (($currentRank / $totalAlternatives) * 100.0) : 100.0;

            $groupCode = '100%';
            $groupLabel = 'Prioritas 4 (60% - 100%)';
            foreach ($thresholds as $th) {
                if ($cumPercent <= (float) $th['max_percent'] + 1e-9) {
                    $groupCode = (string) $th['code'];
                    $groupLabel = (string) $th['label'];
                    break;
                }
            }

            $results[$altId]['rank'] = $currentRank;
            $results[$altId]['cumulative_percent'] = $cumPercent;
            $results[$altId]['group_code'] = $groupCode;
            $results[$altId]['group_label'] = $groupLabel;
        }

        return [
            'weights' => $activeWeights,
            'divisors' => $divisors,
            'ideal_positive' => $idealPositive,
            'ideal_negative' => $idealNegative,
            'results' => $results,
            'sorted_keys' => $sortedKeys,
        ];
    }

    /**
     * Jalankan pipeline lengkap pemeringkatan AHP-TOPSIS pada data warga yang telah diproses parser.
     *
     * @param array<int, array<string, mixed>> $parsedRows Baris hasil BansosDataParserService::processDataset
     * @param array<string, mixed> $customConfig Konfigurasi kustom (weights, desil_scores, program_scores, rtrw_config)
     * @return array{
     *     config: array<string, mixed>,
     *     rtrw_calculation: array<string, mixed>,
     *     topsis_meta: array<string, mixed>,
     *     ranked_rows: array<int, array<string, mixed>>,
     *     excluded_rows: array<int, array<string, mixed>>,
     *     all_rows: array<int, array<string, mixed>>
     * }
     */
    public function rankDataset(array $parsedRows, array $customConfig = []): array
    {
        $config = array_replace_recursive(self::getDefaultConfig(), $customConfig);
        if (isset($customConfig['desil_scores']) && is_array($customConfig['desil_scores'])) {
            $config['desil_scores'] = $customConfig['desil_scores'];
        }
        if (isset($customConfig['program_scores']) && is_array($customConfig['program_scores'])) {
            $config['program_scores'] = $customConfig['program_scores'];
        }

        $rtrwEnabled = (bool) ($config['rtrw_config']['enabled'] ?? true);
        $normalizedWeights = $this->normalizeActiveWeights($config['weights'], $rtrwEnabled);
        $config['normalized_weights'] = $normalizedWeights;

        $desilScores = $config['desil_scores'];
        $programScores = $config['program_scores'];

        // Pisahkan baris yang memenuhi syarat (eligible) vs dikecualikan (excluded)
        $eligibleIndices = [];
        $eligibleRowsForRtRw = [];
        foreach ($parsedRows as $idx => $row) {
            $isExcluded = (bool) ($row['is_excluded'] ?? false);
            if (!$isExcluded) {
                $eligibleIndices[] = $idx;
                $eligibleRowsForRtRw[$idx] = $row;
            }
        }

        // Hitung skor RT/RW (C3) dari populasi warga yang valid
        $rtrwCalc = $this->computeRtRwScores($eligibleRowsForRtRw, $config['rtrw_config']);
        $rtrwStats = $rtrwCalc['stats_by_rtrw'];

        // Bangun matriks keputusan X untuk seluruh warga yang memenuhi syarat
        $decisionMatrix = [];
        foreach ($eligibleIndices as $idx) {
            $row = $parsedRows[$idx];
            $desil = (int) ($row['desil'] ?? 0);
            $jmlProg = (int) ($row['jumlah_program'] ?? 0);
            $rtRwKey = ($row['rw'] ?? '') . '/' . ($row['rt'] ?? '');

            $scoreC1 = (float) ($desilScores[$desil] ?? $desilScores[(string) $desil] ?? 0.0);
            $scoreC2 = (float) ($programScores[$jmlProg] ?? $programScores[(string) $jmlProg] ?? 0.0);
            $scoreC3 = $rtrwEnabled
                ? (float) ($rtrwStats[$rtRwKey]['score'] ?? 1.0)
                : 0.0;

            $decisionMatrix[$idx] = [
                'C1' => $scoreC1,
                'C2' => $scoreC2,
                'C3' => $scoreC3,
            ];
        }

        $matrixCalc = $this->calculateMatrix(
            $decisionMatrix,
            $normalizedWeights,
            $config['criteria_types'] ?? ['C1' => 'benefit', 'C2' => 'benefit', 'C3' => 'benefit'],
            $config['group_thresholds'] ?? null
        );

        $allRows = $parsedRows;
        $rankedRows = [];
        $excludedRows = [];

        foreach ($allRows as $idx => &$row) {
            $rtRwKey = ($row['rw'] ?? '') . '/' . ($row['rt'] ?? '');
            $rtrwInfo = $rtrwStats[$rtRwKey] ?? null;

            if (isset($matrixCalc['results'][$idx])) {
                $tRes = $matrixCalc['results'][$idx];
                $row['skor_desil'] = $tRes['scores']['C1'] ?? 0.0;
                $row['skor_bansos'] = $tRes['scores']['C2'] ?? 0.0;
                $row['skor_rtrw'] = $tRes['scores']['C3'] ?? 0.0;
                $row['proporsi_rtrw_smoothed'] = $rtrwInfo['smoothed_p'] ?? null;
                $row['norm_desil'] = $tRes['normalized']['C1'] ?? 0.0;
                $row['norm_bansos'] = $tRes['normalized']['C2'] ?? 0.0;
                $row['norm_rtrw'] = $tRes['normalized']['C3'] ?? 0.0;
                $row['terbobot_desil'] = $tRes['weighted']['C1'] ?? 0.0;
                $row['terbobot_bansos'] = $tRes['weighted']['C2'] ?? 0.0;
                $row['terbobot_rtrw'] = $tRes['weighted']['C3'] ?? 0.0;
                $row['d_plus'] = $tRes['d_plus'];
                $row['d_minus'] = $tRes['d_minus'];
                $row['nilai_preferensi'] = $tRes['preference_c'];
                $row['nilai_preferensi_rounded'] = $tRes['preference_c_rounded'];
                $row['peringkat'] = $tRes['rank'];
                $row['persentase_kumulatif'] = $tRes['cumulative_percent'];
                $row['kelompok'] = $tRes['group_code'];
                $row['kelompok_label'] = $tRes['group_label'];
            } else {
                $row['skor_desil'] = null;
                $row['skor_bansos'] = null;
                $row['skor_rtrw'] = null;
                $row['proporsi_rtrw_smoothed'] = null;
                $row['d_plus'] = null;
                $row['d_minus'] = null;
                $row['nilai_preferensi'] = null;
                $row['nilai_preferensi_rounded'] = null;
                $row['peringkat'] = null;
                $row['persentase_kumulatif'] = null;
                $row['kelompok'] = 'DIKECUALIKAN';
                $row['kelompok_label'] = 'Dikecualikan dari Pemeringkatan';
                $excludedRows[] = $row;
            }
        }
        unset($row);

        foreach ($matrixCalc['sorted_keys'] ?? [] as $idx) {
            $rankedRows[] = $allRows[$idx];
        }

        return [
            'config' => $config,
            'rtrw_calculation' => [
                'p0' => $rtrwCalc['p0'],
                'm' => $rtrwCalc['m'],
                'total_n' => $rtrwCalc['total_n'],
                'total_target_desil' => $rtrwCalc['total_target_desil'],
                'p_min' => $rtrwCalc['p_min'],
                'p_max' => $rtrwCalc['p_max'],
                'mapping_mode' => $rtrwCalc['mapping_mode'],
                'combination_count' => count($rtrwStats),
            ],
            'topsis_meta' => [
                'weights' => $matrixCalc['weights'],
                'divisors' => $matrixCalc['divisors'],
                'ideal_positive' => $matrixCalc['ideal_positive'],
                'ideal_negative' => $matrixCalc['ideal_negative'],
                'total_ranked' => count($rankedRows),
                'total_excluded' => count($excludedRows),
            ],
            'ranked_rows' => $rankedRows,
            'excluded_rows' => $excludedRows,
            'all_rows' => $allRows,
        ];
    }
}
