<?php

namespace App\Services;

class BansosExcelImportService
{
    public function __construct(
        private readonly XlsxService $xlsxService,
        private readonly BansosDataParserService $parserService
    ) {
    }

    /**
     * Baca file Excel (.xlsx) data warga kelurahan dan kembalikan hasil parse + validasi lengkap.
     *
     * @param string $filePath Path ke file .xlsx
     * @param array<int|string, float|int> $desilScoreMap
     * @param bool $isRtRwCriterionActive
     * @return array{
     *     sheet_name: string,
     *     rows: array<int, array<string, mixed>>,
     *     summary: array<string, mixed>,
     *     kk_multiple_bansos: array<int, array<string, mixed>>
     * }
     */
    public function parseExcelFile(
        string $filePath,
        array $desilScoreMap = [1 => 4, 2 => 3, 3 => 2, 4 => 1],
        bool $isRtRwCriterionActive = true
    ): array {
        $sheetData = $this->xlsxService->readFirstSheet($filePath);
        $rawRows = $sheetData['rows'] ?? [];

        if (empty($rawRows)) {
            return [
                'sheet_name' => $sheetData['sheet_name'] ?? 'Sheet1',
                'rows' => [],
                'summary' => [
                    'total_rows' => 0,
                    'eligible_for_ranking_count' => 0,
                    'excluded_count' => 0,
                    'needs_review_count' => 0,
                    'kk_multiple_bansos_count' => 0,
                    'rw_counts' => [],
                    'rt_rw_counts' => [],
                ],
                'kk_multiple_bansos' => [],
            ];
        }

        // Baris pertama (r=1) adalah header
        $headerRow = $rawRows[0]['cells'] ?? [];
        $colMap = $this->detectColumnMap($headerRow);

        $normalizedInput = [];
        $totalRaw = count($rawRows);

        for ($i = 1; $i < $totalRaw; $i++) {
            $excelRowNumber = (int) ($rawRows[$i]['row_number'] ?? ($i + 1));
            $cells = $rawRows[$i]['cells'] ?? [];

            $seqRaw = trim((string) ($cells[$colMap['seq']] ?? ''));
            $seq = ($seqRaw !== '' && is_numeric($seqRaw)) ? (int) $seqRaw : $i;

            $nik = trim((string) ($cells[$colMap['nik']] ?? ''));
            $noKk = trim((string) ($cells[$colMap['no_kk']] ?? ''));
            $noPbp = trim((string) ($cells[$colMap['no_pbp']] ?? ''));
            $nama = trim((string) ($cells[$colMap['nama']] ?? ''));
            $tglLahirRaw = trim((string) ($cells[$colMap['tanggal_lahir']] ?? ''));
            $hubungan = trim((string) ($cells[$colMap['hubungan_keluarga']] ?? ''));
            $usiaRaw = trim((string) ($cells[$colMap['usia']] ?? ''));
            $alamat = trim((string) ($cells[$colMap['alamat']] ?? ''));
            $rwRaw = trim((string) ($cells[$colMap['rw']] ?? ''));
            $rtRaw = trim((string) ($cells[$colMap['rt']] ?? ''));
            $desilRaw = trim((string) ($cells[$colMap['desil']] ?? ''));
            $bansosRaw = trim((string) ($cells[$colMap['bansos']] ?? ''));
            $keteranganRaw = trim((string) ($cells[$colMap['keterangan']] ?? ''));

            // Lewati baris yang benar-benar kosong seluruhnya
            if (
                $seqRaw === '' && $nik === '' && $noPbp === '' && $nama === ''
                && $rwRaw === '' && $rtRaw === '' && $desilRaw === ''
            ) {
                continue;
            }

            $normalizedInput[] = [
                'seq' => $seq,
                'excel_row_number' => $excelRowNumber,
                'id_anonim' => sprintf('W-%05d', $seq),
                'nik' => $nik,
                'no_kk' => $noKk,
                'no_pbp' => $noPbp,
                'nama' => $nama,
                'tanggal_lahir' => $this->formatExcelDate($tglLahirRaw),
                'hubungan_keluarga' => $hubungan,
                'usia' => is_numeric($usiaRaw) ? (int) $usiaRaw : null,
                'alamat' => $alamat,
                'rw_raw' => $rwRaw,
                'rt_raw' => $rtRaw,
                'desil' => $desilRaw,
                'bansos_raw' => $bansosRaw,
                'keterangan_raw' => $keteranganRaw,
            ];
        }

        $processed = $this->parserService->processDataset(
            $normalizedInput,
            $desilScoreMap,
            $isRtRwCriterionActive
        );

        return [
            'sheet_name' => $sheetData['sheet_name'] ?? 'Sheet1',
            'rows' => $processed['rows'],
            'summary' => $processed['summary'],
            'kk_multiple_bansos' => $processed['kk_multiple_bansos'],
        ];
    }

    /**
     * Deteksi pemetaan kolom Excel berdasarkan nama header atau fallback posisi standar file-bansos.xlsx
     *
     * @param array<string, string> $headerCells
     * @return array<string, string>
     */
    private function detectColumnMap(array $headerCells): array
    {
        $map = [
            'seq' => 'A',
            'nik' => 'B',
            'no_kk' => 'C',
            'no_pbp' => 'D',
            'nama' => 'E',
            'tanggal_lahir' => 'F',
            'hubungan_keluarga' => 'G',
            'usia' => 'H',
            'alamat' => 'I',
            'rw' => 'J',
            'rt' => 'K',
            'desil' => 'L',
            'bansos' => 'M',
            'keterangan' => 'N',
        ];

        foreach ($headerCells as $col => $val) {
            $h = strtoupper(trim($val));
            if ($h === '') {
                continue;
            }
            if (in_array($h, ['NO', 'NO_URUT', 'URUT'], true)) {
                $map['seq'] = $col;
            } elseif ($h === 'NIK') {
                $map['nik'] = $col;
            } elseif (in_array($h, ['NO_KK', 'NOKK', 'NO KK'], true)) {
                $map['no_kk'] = $col;
            } elseif (in_array($h, ['NO PBP', 'NO_PBP', 'NOPBP'], true)) {
                $map['no_pbp'] = $col;
            } elseif ($h === 'NAMA') {
                $map['nama'] = $col;
            } elseif (in_array($h, ['TANGGAL_LAHIR', 'TGL_LAHIR', 'TANGGAL LAHIR'], true)) {
                $map['tanggal_lahir'] = $col;
            } elseif (in_array($h, ['HUBUNGAN_KELUARGA', 'HUBUNGAN KELUARGA', 'SHDK'], true)) {
                $map['hubungan_keluarga'] = $col;
            } elseif (in_array($h, ['USIA', 'UMUR'], true)) {
                $map['usia'] = $col;
            } elseif ($h === 'ALAMAT') {
                $map['alamat'] = $col;
            } elseif (in_array($h, ['NO_RW', 'RW', 'NO RW'], true)) {
                $map['rw'] = $col;
            } elseif (in_array($h, ['NO_RT', 'RT', 'NO RT'], true)) {
                $map['rt'] = $col;
            } elseif ($h === 'DESIL') {
                $map['desil'] = $col;
            } elseif (in_array($h, ['BANSOS', 'PROGRAM_BANSOS', 'JENIS_BANSOS'], true)) {
                $map['bansos'] = $col;
            } elseif (in_array($h, ['KETERANGAN', 'KET'], true)) {
                $map['keterangan'] = $col;
            }
        }

        return $map;
    }

    /**
     * Konversi serial tanggal Excel (misal 25881) ke format YYYY-MM-DD jika numerik.
     */
    private function formatExcelDate(string $raw): string
    {
        if ($raw === '') {
            return '';
        }
        if (is_numeric($raw)) {
            $serial = (int) $raw;
            if ($serial > 1000 && $serial < 80000) {
                $unixTimestamp = ($serial - 25569) * 86400;
                return gmdate('Y-m-d', $unixTimestamp);
            }
        }
        return $raw;
    }
}
