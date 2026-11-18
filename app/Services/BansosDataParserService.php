<?php

namespace App\Services;

class BansosDataParserService
{
    /**
     * Bakukan nilai RT atau RW sebagai teks 3 digit (misal "1" -> "001").
     *
     * @param mixed $rawValue Nilai mentah RT atau RW
     * @param bool $allowZero Apakah nilai 0 ("000") diizinkan sebagai format numerik valid (RT=0 valid tapi ditandai review)
     * @return array{formatted: string, is_valid: bool, is_zero: bool, raw: string}
     */
    public function parseRtOrRw(mixed $rawValue, bool $allowZero = true): array
    {
        $raw = trim((string) ($rawValue ?? ''));

        if ($raw === '' || !preg_match('/^\d+$/', $raw)) {
            return [
                'formatted' => $raw,
                'is_valid' => false,
                'is_zero' => false,
                'raw' => $raw,
            ];
        }

        $intVal = (int) $raw;
        if ($intVal < 0 || $intVal > 999) {
            return [
                'formatted' => $raw,
                'is_valid' => false,
                'is_zero' => false,
                'raw' => $raw,
            ];
        }

        if ($intVal === 0 && !$allowZero) {
            return [
                'formatted' => '000',
                'is_valid' => false,
                'is_zero' => true,
                'raw' => $raw,
            ];
        }

        $formatted = str_pad((string) $intVal, 3, '0', STR_PAD_LEFT);

        return [
            'formatted' => $formatted,
            'is_valid' => true,
            'is_zero' => $intVal === 0,
            'raw' => $raw,
        ];
    }

    /**
     * Pasangan parser RT dan RW.
     *
     * @param mixed $rawRt
     * @param mixed $rawRw
     * @return array{
     *     rt: string,
     *     rw: string,
     *     rt_valid: bool,
     *     rw_valid: bool,
     *     rt_rw_valid: bool,
     *     rt_is_zero: bool
     * }
     */
    public function parseRtRwPair(mixed $rawRt, mixed $rawRw): array
    {
        $rtParsed = $this->parseRtOrRw($rawRt, allowZero: true);
        $rwParsed = $this->parseRtOrRw($rawRw, allowZero: false);

        $rtRwValid = $rtParsed['is_valid'] && $rwParsed['is_valid'];

        return [
            'rt' => $rtParsed['formatted'],
            'rw' => $rwParsed['formatted'],
            'rt_valid' => $rtParsed['is_valid'],
            'rw_valid' => $rwParsed['is_valid'],
            'rt_rw_valid' => $rtRwValid,
            'rt_is_zero' => $rtParsed['is_valid'] && $rtParsed['is_zero'],
        ];
    }

    /**
     * Parser kolom bansos sesuai aturan:
     * - "Sembako,PKH" = 2 program (tercatat)
     * - "Sembako" = 1 program (tercatat)
     * - kosong "" = 0 program (dicatat sebagai "tidak_tercatat", bukan "pasti belum menerima")
     * - nilai lain atau berisi kata "pindah" = tidak valid
     *
     * @param mixed $rawBansos
     * @return array{
     *     raw: string,
     *     jumlah_program: int|null,
     *     status_bansos: string,
     *     label_status: string,
     *     is_valid: bool,
     *     contains_pindah: bool
     * }
     */
    public function parseBansos(mixed $rawBansos): array
    {
        $raw = trim((string) ($rawBansos ?? ''));
        $containsPindah = stripos($raw, 'pindah') !== false;

        if ($containsPindah) {
            return [
                'raw' => $raw,
                'jumlah_program' => null,
                'status_bansos' => 'tidak_valid',
                'label_status' => 'Tidak Valid (Memuat Status Pindah)',
                'is_valid' => false,
                'contains_pindah' => true,
            ];
        }

        if ($raw === '') {
            return [
                'raw' => '',
                'jumlah_program' => 0,
                'status_bansos' => 'tidak_tercatat',
                'label_status' => 'Tidak Tercatat (0 Program)',
                'is_valid' => true,
                'contains_pindah' => false,
            ];
        }

        // Normalisasi pemisah koma dan spasi
        $normalized = strtolower((string) preg_replace('/\s*,\s*/', ',', $raw));

        if ($normalized === 'sembako') {
            return [
                'raw' => $raw,
                'jumlah_program' => 1,
                'status_bansos' => 'tercatat',
                'label_status' => 'Tercatat 1 Program (Sembako)',
                'is_valid' => true,
                'contains_pindah' => false,
            ];
        }

        if ($normalized === 'sembako,pkh' || $normalized === 'pkh,sembako') {
            return [
                'raw' => $raw,
                'jumlah_program' => 2,
                'status_bansos' => 'tercatat',
                'label_status' => 'Tercatat 2 Program (Sembako + PKH)',
                'is_valid' => true,
                'contains_pindah' => false,
            ];
        }

        return [
            'raw' => $raw,
            'jumlah_program' => null,
            'status_bansos' => 'tidak_valid',
            'label_status' => 'Tidak Valid (' . $raw . ')',
            'is_valid' => false,
            'contains_pindah' => false,
        ];
    }

    /**
     * Deteksi status pindah dari kolom keterangan dan kolom bansos.
     *
     * @param mixed $rawKeterangan
     * @param mixed $rawBansos
     * @return array{
     *     is_pindah: bool,
     *     pindah_in_keterangan: bool,
     *     pindah_in_bansos: bool,
     *     pindah_only_in_bansos: bool
     * }
     */
    public function detectPindah(mixed $rawKeterangan, mixed $rawBansos): array
    {
        $ket = trim((string) ($rawKeterangan ?? ''));
        $ban = trim((string) ($rawBansos ?? ''));

        $inKet = stripos($ket, 'pindah') !== false;
        $inBan = stripos($ban, 'pindah') !== false;

        return [
            'is_pindah' => $inKet || $inBan,
            'pindah_in_keterangan' => $inKet,
            'pindah_in_bansos' => $inBan,
            'pindah_only_in_bansos' => $inBan && !$inKet,
        ];
    }

    /**
     * Proses seluruh kumpulan baris data warga sekaligus:
     * - Validasi RT/RW, Desil, Bansos, dan Keterangan Pindah
     * - Hitung frekuensi RT/RW, frekuensi RW, dan aturan 1 KK 1 bansos
     * - Tentukan status pengecualian (is_excluded, exclusion_reasons)
     * - Tentukan penandaan pemeriksaan petugas (needs_review, review_reasons)
     * - Jangan pernah menghapus baris
     *
     * @param array<int, array<string, mixed>> $rows Daftar baris warga mentah
     * @param array<int|string, float|int> $desilScoreMap Peta skor Desil aktif (default: [1=>4, 2=>3, 3=>2, 4=>1])
     * @param bool $isRtRwCriterionActive Apakah kriteria C3 (Prioritas RT/RW) sedang aktif
     * @return array{
     *     rows: array<int, array<string, mixed>>,
     *     summary: array<string, mixed>,
     *     kk_multiple_bansos: array<string, array<string, mixed>>
     * }
     */
    public function processDataset(
        array $rows,
        array $desilScoreMap = [1 => 4, 2 => 3, 3 => 2, 4 => 1],
        bool $isRtRwCriterionActive = true
    ): array {
        $parsedRows = [];
        $rwCounts = [];
        $rtRwCounts = [];
        $kkProgramRecipients = [];

        foreach ($rows as $idx => $row) {
            $seq = isset($row['seq']) && is_numeric($row['seq']) ? (int) $row['seq'] : ($idx + 1);
            $excelRow = isset($row['excel_row_number']) && is_numeric($row['excel_row_number'])
                ? (int) $row['excel_row_number']
                : ($seq + 1);
            $idAnonim = !empty($row['id_anonim']) ? (string) $row['id_anonim'] : sprintf('W-%05d', $seq);

            $rawRt = $row['rt_raw'] ?? $row['rt'] ?? $row['NO_RT'] ?? '';
            $rawRw = $row['rw_raw'] ?? $row['rw'] ?? $row['NO_RW'] ?? '';
            $rawBansos = $row['bansos_raw'] ?? $row['bansos'] ?? '';
            $rawKeterangan = $row['keterangan_raw'] ?? $row['keterangan'] ?? $row['KETERANGAN'] ?? '';
            $rawDesil = $row['desil'] ?? $row['DESIL'] ?? null;
            $noKk = trim((string) ($row['no_kk'] ?? $row['NO_KK'] ?? ''));

            $rtRw = $this->parseRtRwPair($rawRt, $rawRw);
            $bansos = $this->parseBansos($rawBansos);
            $pindah = $this->detectPindah($rawKeterangan, $rawBansos);

            $desilStr = trim((string) ($rawDesil ?? ''));
            $desilInt = ($desilStr !== '' && preg_match('/^-?\d+$/', $desilStr)) ? (int) $desilStr : null;
            $desilValid = $desilInt !== null && (
                array_key_exists($desilInt, $desilScoreMap) || array_key_exists((string) $desilInt, $desilScoreMap)
            );

            if ($rtRw['rt_rw_valid']) {
                $rwKey = $rtRw['rw'];
                $rtRwKey = $rtRw['rw'] . '/' . $rtRw['rt'];
                $rwCounts[$rwKey] = ($rwCounts[$rwKey] ?? 0) + 1;
                $rtRwCounts[$rtRwKey] = ($rtRwCounts[$rtRwKey] ?? 0) + 1;
            }

            if ($noKk !== '' && $bansos['is_valid'] && ($bansos['jumlah_program'] ?? 0) >= 1) {
                if (!isset($kkProgramRecipients[$noKk])) {
                    $kkProgramRecipients[$noKk] = [];
                }
                $kkProgramRecipients[$noKk][] = [
                    'seq' => $seq,
                    'excel_row_number' => $excelRow,
                    'id_anonim' => $idAnonim,
                    'nama' => (string) ($row['nama'] ?? ''),
                    'nik' => (string) ($row['nik'] ?? ''),
                    'hubungan_keluarga' => (string) ($row['hubungan_keluarga'] ?? ''),
                    'jumlah_program' => $bansos['jumlah_program'],
                    'bansos_raw' => $bansos['raw'],
                    'rw' => $rtRw['rw'],
                    'rt' => $rtRw['rt'],
                    'desil' => $desilInt,
                ];
            }

            $parsedRows[$idx] = array_merge($row, [
                'seq' => $seq,
                'excel_row_number' => $excelRow,
                'id_anonim' => $idAnonim,
                'no_kk' => $noKk,
                'rt' => $rtRw['rt'],
                'rw' => $rtRw['rw'],
                'rt_raw' => trim((string) $rawRt),
                'rw_raw' => trim((string) $rawRw),
                'rt_rw_valid' => $rtRw['rt_rw_valid'],
                'rt_is_zero' => $rtRw['rt_is_zero'],
                'desil' => $desilInt,
                'desil_valid' => $desilValid,
                'bansos_raw' => $bansos['raw'],
                'jumlah_program' => $bansos['jumlah_program'] ?? 0,
                'bansos_valid' => $bansos['is_valid'],
                'status_bansos' => $bansos['status_bansos'],
                'label_status_bansos' => $bansos['label_status'],
                'keterangan_raw' => trim((string) $rawKeterangan),
                'is_pindah' => $pindah['is_pindah'],
                'pindah_only_in_bansos' => $pindah['pindah_only_in_bansos'],
            ]);
        }

        // Filter KK yang memiliki > 1 baris penerima program bansos
        $kkMultipleBansos = [];
        foreach ($kkProgramRecipients as $noKk => $members) {
            if (count($members) > 1) {
                $kkMultipleBansos[$noKk] = [
                    'no_kk' => $noKk,
                    'no_kk_masked' => substr($noKk, 0, 4) . str_repeat('*', max(0, strlen($noKk) - 8)) . substr($noKk, -4),
                    'recipient_count' => count($members),
                    'members' => $members,
                ];
            }
        }

        $excludedCount = 0;
        $reviewCount = 0;

        foreach ($parsedRows as $idx => &$pRow) {
            $exclusionReasons = [];
            $reviewReasons = [];

            // 1. Evaluasi alasan pengecualian dari pemeringkatan
            if ($pRow['is_pindah']) {
                $exclusionReasons[] = 'Warga tercatat pindah (' . (
                    $pRow['pindah_only_in_bansos']
                        ? 'tertulis di kolom bansos: ' . $pRow['bansos_raw']
                        : 'tertulis di kolom keterangan: ' . $pRow['keterangan_raw']
                ) . ')';
            }

            if (!$pRow['desil_valid']) {
                $exclusionReasons[] = 'Desil di luar tabel skor (' . ($pRow['desil'] ?? 'kosong') . ')';
            }

            if (!$pRow['bansos_valid'] && !$pRow['is_pindah']) {
                $exclusionReasons[] = 'Nilai kolom bansos tidak valid (' . $pRow['bansos_raw'] . ')';
            }

            if ($isRtRwCriterionActive && !$pRow['rt_rw_valid']) {
                $exclusionReasons[] = sprintf(
                    'RT/RW tidak valid (RW: "%s", RT: "%s")',
                    $pRow['rw_raw'],
                    $pRow['rt_raw']
                );
            }

            $isExcluded = count($exclusionReasons) > 0;
            if ($isExcluded) {
                $excludedCount++;
            }

            // 2. Evaluasi penandaan "perlu dicek petugas" (tanpa menghapus baris)
            if (!$pRow['rt_rw_valid']) {
                $reviewReasons[] = sprintf(
                    'RT/RW tidak valid (RW: "%s", RT: "%s")',
                    $pRow['rw_raw'],
                    $pRow['rt_raw']
                );
            } else {
                $rwKey = $pRow['rw'];
                $rtRwKey = $pRow['rw'] . '/' . $pRow['rt'];
                $rwPop = $rwCounts[$rwKey] ?? 0;
                $rtRwPop = $rtRwCounts[$rtRwKey] ?? 0;

                if ($pRow['rt_is_zero']) {
                    $reviewReasons[] = sprintf('RT bernilai 0 (RW %s / RT %s)', $pRow['rw'], $pRow['rt']);
                }

                if ($rwPop <= 5) {
                    $reviewReasons[] = sprintf('RW dengan 5 warga atau kurang (RW %s hanya %d warga)', $pRow['rw'], $rwPop);
                }

                if ($rtRwPop <= 3) {
                    $reviewReasons[] = sprintf(
                        'Kombinasi RT/RW sangat jarang (RW %s / RT %s hanya %d warga)',
                        $pRow['rw'],
                        $pRow['rt'],
                        $rtRwPop
                    );
                }
            }

            if ($pRow['pindah_only_in_bansos']) {
                $reviewReasons[] = sprintf(
                    'Status pindah hanya tertulis di kolom bansos ("%s"), kolom keterangan kosong',
                    $pRow['bansos_raw']
                );
            }

            $noKk = $pRow['no_kk'];
            if ($noKk !== '' && isset($kkMultipleBansos[$noKk]) && $pRow['bansos_valid'] && $pRow['jumlah_program'] >= 1) {
                $reviewReasons[] = sprintf(
                    'Aturan 1 KK 1 Bansos: NO_KK ini memiliki %d anggota keluarga yang tercatat menerima bansos',
                    $kkMultipleBansos[$noKk]['recipient_count']
                );
            }

            $needsReview = count($reviewReasons) > 0;
            if ($needsReview) {
                $reviewCount++;
            }

            $pRow['is_excluded'] = $isExcluded;
            $pRow['exclusion_reasons'] = $exclusionReasons;
            $pRow['needs_review'] = $needsReview;
            $pRow['review_reasons'] = $reviewReasons;
            $pRow['rw_population'] = $pRow['rt_rw_valid'] ? ($rwCounts[$pRow['rw']] ?? 0) : 0;
            $pRow['rt_rw_population'] = $pRow['rt_rw_valid'] ? ($rtRwCounts[$pRow['rw'] . '/' . $pRow['rt']] ?? 0) : 0;
        }
        unset($pRow);

        return [
            'rows' => $parsedRows,
            'summary' => [
                'total_rows' => count($parsedRows),
                'eligible_for_ranking_count' => count($parsedRows) - $excludedCount,
                'excluded_count' => $excludedCount,
                'needs_review_count' => $reviewCount,
                'kk_multiple_bansos_count' => count($kkMultipleBansos),
                'rw_counts' => $rwCounts,
                'rt_rw_counts' => $rtRwCounts,
            ],
            'kk_multiple_bansos' => array_values($kkMultipleBansos),
        ];
    }
}
