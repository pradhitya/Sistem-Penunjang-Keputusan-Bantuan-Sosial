<?php

namespace App\Services;

use InvalidArgumentException;

class AhpService
{
    /**
     * Random Consistency Index (RI) Saaty untuk ukuran matriks n = 1..10
     */
    private const RI_TABLE = [
        1 => 0.00,
        2 => 0.00,
        3 => 0.58,
        4 => 0.90,
        5 => 1.12,
        6 => 1.24,
        7 => 1.32,
        8 => 1.41,
        9 => 1.45,
        10 => 1.49,
    ];

    /**
     * Hitung eigenvektor utama (bobot), lambda_max, CI, dan CR dari matriks perbandingan berpasangan.
     *
     * @param array<int, array<int, float|int>> $matrix Matriks perbandingan berpasangan n x n
     * @param int $maxIterations Iterasi maksimum metode pangkat (power iteration)
     * @param float $tolerance Toleransi konvergensi eigenvektor
     * @return array{
     *     n: int,
     *     weights: array<int, float>,
     *     column_average_weights: array<int, float>,
     *     lambda_max: float,
     *     ci: float,
     *     ri: float,
     *     cr: float,
     *     is_consistent: bool,
     *     warning: string|null
     * }
     */
    public function calculate(array $matrix, int $maxIterations = 200, float $tolerance = 1e-12): array
    {
        $n = count($matrix);
        if ($n < 1) {
            throw new InvalidArgumentException('Matriks AHP tidak boleh kosong.');
        }

        $cleanMatrix = [];
        for ($i = 0; $i < $n; $i++) {
            if (!isset($matrix[$i]) || !is_array($matrix[$i]) || count($matrix[$i]) !== $n) {
                throw new InvalidArgumentException("Matriks AHP harus berukuran {$n}x{$n}.");
            }
            $row = array_values($matrix[$i]);
            $cleanRow = [];
            for ($j = 0; $j < $n; $j++) {
                $val = (float) $row[$j];
                if ($val <= 0) {
                    throw new InvalidArgumentException("Nilai matriks AHP pada [{$i}][{$j}] harus lebih besar dari 0.");
                }
                $cleanRow[$j] = $val;
            }
            $cleanMatrix[$i] = $cleanRow;
        }

        // 1. Pendekatan rata-rata kolom ternormalisasi (Approximation Saaty)
        $colSums = array_fill(0, $n, 0.0);
        for ($j = 0; $j < $n; $j++) {
            for ($i = 0; $i < $n; $i++) {
                $colSums[$j] += $cleanMatrix[$i][$j];
            }
        }

        $colAvgWeights = array_fill(0, $n, 0.0);
        for ($i = 0; $i < $n; $i++) {
            $rowSum = 0.0;
            for ($j = 0; $j < $n; $j++) {
                $rowSum += $cleanMatrix[$i][$j] / ($colSums[$j] > 0 ? $colSums[$j] : 1.0);
            }
            $colAvgWeights[$i] = $rowSum / $n;
        }
        $colAvgWeights = $this->normalizeWeights($colAvgWeights);

        // 2. Eigenvektor utama menggunakan Power Method (Principal Eigenvector)
        $weights = $colAvgWeights;
        for ($iter = 0; $iter < $maxIterations; $iter++) {
            $next = array_fill(0, $n, 0.0);
            for ($i = 0; $i < $n; $i++) {
                $sum = 0.0;
                for ($j = 0; $j < $n; $j++) {
                    $sum += $cleanMatrix[$i][$j] * $weights[$j];
                }
                $next[$i] = $sum;
            }

            $next = $this->normalizeWeights($next);

            $diff = 0.0;
            for ($i = 0; $i < $n; $i++) {
                $diff = max($diff, abs($next[$i] - $weights[$i]));
            }
            $weights = $next;
            if ($diff < $tolerance) {
                break;
            }
        }

        // 3. Hitung A * w dan lambda_max
        $aw = array_fill(0, $n, 0.0);
        for ($i = 0; $i < $n; $i++) {
            $sum = 0.0;
            for ($j = 0; $j < $n; $j++) {
                $sum += $cleanMatrix[$i][$j] * $weights[$j];
            }
            $aw[$i] = $sum;
        }

        $lambdaMax = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $lambdaMax += $aw[$i] / ($weights[$i] > 0 ? $weights[$i] : 1.0);
        }
        $lambdaMax /= $n;

        // 4. Hitung CI dan CR
        $ci = $n > 1 ? ($lambdaMax - $n) / ($n - 1) : 0.0;
        $ri = self::RI_TABLE[$n] ?? 1.49;
        $cr = $ri > 0 ? ($ci / $ri) : 0.0;

        $isConsistent = $cr < 0.1;
        $warning = !$isConsistent
            ? sprintf(
                'Peringatan: Consistency Ratio (CR = %.4f) >= 0,10. Matriks perbandingan berpasangan tidak konsisten, silakan tinjau kembali perbandingan antar kriteria.',
                $cr
            )
            : null;

        return [
            'n' => $n,
            'weights' => $weights,
            'column_average_weights' => $colAvgWeights,
            'lambda_max' => $lambdaMax,
            'ci' => $ci,
            'ri' => $ri,
            'cr' => $cr,
            'is_consistent' => $isConsistent,
            'warning' => $warning,
        ];
    }

    /**
     * Normalkan vektor bobot agar jumlahnya tepat 1.0
     *
     * @param array<int|string, float|int> $weights
     * @return array<int|string, float>
     */
    public function normalizeWeights(array $weights): array
    {
        $sum = 0.0;
        foreach ($weights as $w) {
            $sum += max(0.0, (float) $w);
        }

        if ($sum <= 0.0) {
            $count = count($weights);
            if ($count === 0) {
                return [];
            }
            $equal = 1.0 / $count;
            return array_map(fn () => $equal, $weights);
        }

        $normalized = [];
        foreach ($weights as $k => $w) {
            $normalized[$k] = max(0.0, (float) $w) / $sum;
        }

        return $normalized;
    }
}
