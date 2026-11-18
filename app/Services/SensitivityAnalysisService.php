<?php

namespace App\Services;

class SensitivityAnalysisService
{
    public function __construct(
        private readonly TopsisService $topsisService
    ) {
    }

    /**
     * Jalankan uji sensitivitas lengkap terhadap peringkat dasar:
     * 1. Skenario Dasar (Baseline)
     * 2. Bobot Sama Rata (1/3, 1/3, 1/3)
     * 3. Desil Saja (100% C1)
     * 4. Tanpa Kriteria RT/RW (C3 = 0, C1 & C2 dinormalkan ulang)
     * 5. Tiap bobot +20% dan -20% (bobot lain disesuaikan proporsional agar jumlah = 1)
     *
     * @param array<int, array<string, mixed>> $parsedRows Baris hasil BansosDataParserService::processDataset
     * @param array<string, mixed> $baseConfig Konfigurasi dasar
     * @return array<string, mixed>
     */
    public function runSensitivityAnalysis(array $parsedRows, array $baseConfig = []): array
    {
        $config = array_replace_recursive(TopsisService::getDefaultConfig(), $baseConfig);
        if (isset($baseConfig['desil_scores']) && is_array($baseConfig['desil_scores'])) {
            $config['desil_scores'] = $baseConfig['desil_scores'];
        }
        if (isset($baseConfig['program_scores']) && is_array($baseConfig['program_scores'])) {
            $config['program_scores'] = $baseConfig['program_scores'];
        }

        // Ambil baris yang memenuhi syarat pada skenario dasar
        $eligibleIndices = [];
        $eligibleRowsForRtRw = [];
        foreach ($parsedRows as $idx => $row) {
            if (empty($row['is_excluded'])) {
                $eligibleIndices[] = $idx;
                $eligibleRowsForRtRw[$idx] = $row;
            }
        }

        $totalEligible = count($eligibleIndices);
        if ($totalEligible === 0) {
            return [
                'total_alternatives' => 0,
                'top_10_cutoff_count' => 0,
                'baseline_weights' => [],
                'scenarios' => [],
            ];
        }

        // Hitung matriks keputusan X sekali saja karena skor sub-kriteria tetap sama antar skenario bobot
        $rtrwCalc = $this->topsisService->computeRtRwScores($eligibleRowsForRtRw, $config['rtrw_config']);
        $rtrwStats = $rtrwCalc['stats_by_rtrw'];
        $desilScores = $config['desil_scores'];
        $programScores = $config['program_scores'];

        $decisionMatrix = [];
        foreach ($eligibleIndices as $idx) {
            $row = $parsedRows[$idx];
            $desil = (int) ($row['desil'] ?? 0);
            $jmlProg = (int) ($row['jumlah_program'] ?? 0);
            $rtRwKey = ($row['rw'] ?? '') . '/' . ($row['rt'] ?? '');

            $decisionMatrix[$idx] = [
                'C1' => (float) ($desilScores[$desil] ?? $desilScores[(string) $desil] ?? 0.0),
                'C2' => (float) ($programScores[$jmlProg] ?? $programScores[(string) $jmlProg] ?? 0.0),
                'C3' => (float) ($rtrwStats[$rtRwKey]['score'] ?? 1.0),
            ];
        }

        $baseWeights = $this->topsisService->normalizeActiveWeights($config['weights'], true);
        $criteriaTypes = $config['criteria_types'] ?? ['C1' => 'benefit', 'C2' => 'benefit', 'C3' => 'benefit'];

        // Bangun daftar skenario
        $scenarioDefs = [
            [
                'key' => 'baseline',
                'name' => 'Skenario Dasar (AHP Default)',
                'description' => 'Bobot utama hasil AHP (C1 Desil, C2 Pemerataan Bansos, C3 Prioritas RT/RW)',
                'weights' => $baseWeights,
            ],
            [
                'key' => 'equal_weights',
                'name' => 'Bobot Sama Rata',
                'description' => 'Ketiga kriteria diberi bobot setara (masing-masing 33,33%)',
                'weights' => ['C1' => 1.0 / 3.0, 'C2' => 1.0 / 3.0, 'C3' => 1.0 / 3.0],
            ],
            [
                'key' => 'desil_only',
                'name' => 'Desil Saja (100%)',
                'description' => 'Hanya menggunakan kriteria C1 (Desil = 100%, kriteria lain = 0%)',
                'weights' => ['C1' => 1.0, 'C2' => 0.0, 'C3' => 0.0],
            ],
            [
                'key' => 'no_rtrw',
                'name' => 'Tanpa Kriteria RT/RW',
                'description' => 'Kriteria C3 (RT/RW) dimatikan, bobot C1 dan C2 dinormalkan ulang secara proporsional',
                'weights' => $this->topsisService->normalizeActiveWeights($baseWeights, false),
            ],
            [
                'key' => 'c1_plus_20',
                'name' => 'Bobot C1 (Desil) +20%',
                'description' => 'Bobot Desil dinaikkan 20%, bobot C2 & C3 disesuaikan proporsional',
                'weights' => $this->perturbWeight($baseWeights, 'C1', 0.20),
            ],
            [
                'key' => 'c1_minus_20',
                'name' => 'Bobot C1 (Desil) -20%',
                'description' => 'Bobot Desil diturunkan 20%, bobot C2 & C3 disesuaikan proporsional',
                'weights' => $this->perturbWeight($baseWeights, 'C1', -0.20),
            ],
            [
                'key' => 'c2_plus_20',
                'name' => 'Bobot C2 (Pemerataan Bansos) +20%',
                'description' => 'Bobot Pemerataan Bansos dinaikkan 20%, bobot C1 & C3 disesuaikan proporsional',
                'weights' => $this->perturbWeight($baseWeights, 'C2', 0.20),
            ],
            [
                'key' => 'c2_minus_20',
                'name' => 'Bobot C2 (Pemerataan Bansos) -20%',
                'description' => 'Bobot Pemerataan Bansos diturunkan 20%, bobot C1 & C3 disesuaikan proporsional',
                'weights' => $this->perturbWeight($baseWeights, 'C2', -0.20),
            ],
            [
                'key' => 'c3_plus_20',
                'name' => 'Bobot C3 (Prioritas RT/RW) +20%',
                'description' => 'Bobot Prioritas RT/RW dinaikkan 20%, bobot C1 & C2 disesuaikan proporsional',
                'weights' => $this->perturbWeight($baseWeights, 'C3', 0.20),
            ],
            [
                'key' => 'c3_minus_20',
                'name' => 'Bobot C3 (Prioritas RT/RW) -20%',
                'description' => 'Bobot Prioritas RT/RW diturunkan 20%, bobot C1 & C2 disesuaikan proporsional',
                'weights' => $this->perturbWeight($baseWeights, 'C3', -0.20),
            ],
        ];

        // Hitung peringkat dasar terlebih dahulu
        $baselineCalc = $this->topsisService->calculateMatrix($decisionMatrix, $baseWeights, $criteriaTypes);
        $baselineResults = $baselineCalc['results'];
        $baselineSortedKeys = $baselineCalc['sorted_keys'];

        $top10Count = max(1, (int) floor($totalEligible * 0.10));
        $baselineTop10Set = array_flip(array_slice($baselineSortedKeys, 0, $top10Count));
        $baselineMidranks = $this->computeMidranks($baselineResults, $baselineSortedKeys);

        $scenariosOutput = [];

        foreach ($scenarioDefs as $scen) {
            $calc = $scen['key'] === 'baseline'
                ? $baselineCalc
                : $this->topsisService->calculateMatrix($decisionMatrix, $scen['weights'], $criteriaTypes);

            $scenResults = $calc['results'];
            $scenSortedKeys = $calc['sorted_keys'];
            $scenMidranks = $this->computeMidranks($scenResults, $scenSortedKeys);

            // Korelasi Spearman (Pearson correlation atas midranks, identik dengan scipy.stats.spearmanr)
            $spearmanRho = $this->pearsonCorrelation($baselineMidranks, $scenMidranks);

            // Irisan 10% teratas dengan skenario dasar
            $scenTop10Keys = array_slice($scenSortedKeys, 0, $top10Count);
            $overlapCount = 0;
            foreach ($scenTop10Keys as $k) {
                if (isset($baselineTop10Set[$k])) {
                    $overlapCount++;
                }
            }
            $overlapPercent = $top10Count > 0 ? (($overlapCount / $top10Count) * 100.0) : 100.0;

            // Hitung rata-rata pergeseran peringkat absolut
            $sumRankShift = 0;
            $maxRankShift = 0;
            foreach ($eligibleIndices as $idx) {
                $shift = abs(($baselineResults[$idx]['rank'] ?? 1) - ($scenResults[$idx]['rank'] ?? 1));
                $sumRankShift += $shift;
                if ($shift > $maxRankShift) {
                    $maxRankShift = $shift;
                }
            }
            $meanRankShift = $totalEligible > 0 ? ($sumRankShift / $totalEligible) : 0.0;

            $scenariosOutput[] = [
                'key' => $scen['key'],
                'name' => $scen['name'],
                'description' => $scen['description'],
                'weights' => [
                    'C1' => round($scen['weights']['C1'] ?? 0.0, 6),
                    'C2' => round($scen['weights']['C2'] ?? 0.0, 6),
                    'C3' => round($scen['weights']['C3'] ?? 0.0, 6),
                ],
                'spearman_correlation' => round($spearmanRho, 6),
                'top_10_overlap_count' => $overlapCount,
                'top_10_total_count' => $top10Count,
                'top_10_overlap_percent' => round($overlapPercent, 2),
                'mean_rank_shift' => round($meanRankShift, 2),
                'max_rank_shift' => $maxRankShift,
            ];
        }

        return [
            'total_alternatives' => $totalEligible,
            'top_10_cutoff_count' => $top10Count,
            'baseline_weights' => $baseWeights,
            'scenarios' => $scenariosOutput,
        ];
    }

    /**
     * Ubah satu bobot kriteria sebesar delta (+20% atau -20%) dan sesuaikan bobot lain secara proporsional
     * sehingga total bobot tetap = 1.0.
     *
     * @param array<string, float> $baseWeights
     * @param string $targetCode
     * @param float $deltaRelative Misal +0.20 atau -0.20
     * @return array<string, float>
     */
    public function perturbWeight(array $baseWeights, string $targetCode, float $deltaRelative): array
    {
        $wTarget = (float) ($baseWeights[$targetCode] ?? 0.0);
        $newTarget = min(1.0, max(0.0, $wTarget * (1.0 + $deltaRelative)));
        $remainingNew = 1.0 - $newTarget;

        $otherSum = 0.0;
        foreach ($baseWeights as $code => $val) {
            if ($code !== $targetCode) {
                $otherSum += (float) $val;
            }
        }

        $result = [];
        foreach ($baseWeights as $code => $val) {
            if ($code === $targetCode) {
                $result[$code] = $newTarget;
            } else {
                $result[$code] = $otherSum > 0.0
                    ? ($remainingNew * ((float) $val / $otherSum))
                    : 0.0;
            }
        }

        return $result;
    }

    /**
     * Hitung fractional ranks (midranks) untuk penanganan tie yang akurat pada korelasi Spearman.
     *
     * @param array<int|string, array<string, mixed>> $results
     * @param array<int, int|string> $sortedKeys
     * @return array<int|string, float>
     */
    private function computeMidranks(array $results, array $sortedKeys): array
    {
        $midranks = [];
        $n = count($sortedKeys);
        $i = 0;

        while ($i < $n) {
            $j = $i;
            $cVal = $results[$sortedKeys[$i]]['preference_c_rounded'];
            while ($j + 1 < $n && $results[$sortedKeys[$j + 1]]['preference_c_rounded'] === $cVal) {
                $j++;
            }
            // Posisi 1-based dari i+1 sampai j+1 memiliki rata-rata peringkat (i + 1 + j + 1) / 2
            $avgRank = (($i + 1) + ($j + 1)) / 2.0;
            for ($k = $i; $k <= $j; $k++) {
                $midranks[$sortedKeys[$k]] = $avgRank;
            }
            $i = $j + 1;
        }

        return $midranks;
    }

    /**
     * Hitung korelasi Pearson antara dua vektor peringkat bernilai indeks sama.
     *
     * @param array<int|string, float> $x
     * @param array<int|string, float> $y
     * @return float
     */
    private function pearsonCorrelation(array $x, array $y): float
    {
        $n = count($x);
        if ($n === 0) {
            return 1.0;
        }

        $sumX = 0.0;
        $sumY = 0.0;
        foreach ($x as $k => $vx) {
            $sumX += $vx;
            $sumY += $y[$k];
        }
        $meanX = $sumX / $n;
        $meanY = $sumY / $n;

        $cov = 0.0;
        $varX = 0.0;
        $varY = 0.0;

        foreach ($x as $k => $vx) {
            $dx = $vx - $meanX;
            $dy = $y[$k] - $meanY;
            $cov += $dx * $dy;
            $varX += $dx * $dx;
            $varY += $dy * $dy;
        }

        $denom = sqrt($varX * $varY);
        if ($denom <= 0.0) {
            return 1.0;
        }

        return max(-1.0, min(1.0, $cov / $denom));
    }
}
