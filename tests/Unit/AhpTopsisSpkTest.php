<?php

namespace Tests\Unit;

use App\Services\AhpService;
use App\Services\BansosDataParserService;
use App\Services\BansosExcelImportService;
use App\Services\SensitivityAnalysisService;
use App\Services\TopsisService;
use App\Services\XlsxService;
use PHPUnit\Framework\TestCase;

class AhpTopsisSpkTest extends TestCase
{
    /**
     * (a) Tes TOPSIS pada contoh kecil yang dihitung manual
     * Termasuk: normalisasi vektor, bobot, A+/A-, D+/D-, nilai C, pembagi nol (C=0,5),
     * dan tie-breaking metode "min" setelah pembulatan 10 desimal.
     */
    public function test_topsis_manual_small_example(): void
    {
        $topsis = new TopsisService();

        // Matriks keputusan 4 alternatif x 3 kriteria (semua benefit)
        // A1 dan A2 sengaja dibuat kembar untuk menguji metode peringkat "min"
        // Kolom C1: [4, 4, 3, 1] -> sum_sq = 16 + 16 + 9 + 1 = 42 -> sqrt(42)
        // Kolom C2: [3, 3, 2, 1] -> sum_sq = 9 + 9 + 4 + 1 = 23 -> sqrt(23)
        // Kolom C3: [4, 4, 2, 1] -> sum_sq = 16 + 16 + 4 + 1 = 37 -> sqrt(37)
        $matrix = [
            'W-00001' => ['C1' => 4.0, 'C2' => 3.0, 'C3' => 4.0],
            'W-00002' => ['C1' => 4.0, 'C2' => 3.0, 'C3' => 4.0],
            'W-00003' => ['C1' => 3.0, 'C2' => 2.0, 'C3' => 2.0],
            'W-00004' => ['C1' => 1.0, 'C2' => 1.0, 'C3' => 1.0],
        ];
        $weights = ['C1' => 0.633, 'C2' => 0.261, 'C3' => 0.106];

        $calc = $topsis->calculateMatrix($matrix, $weights);

        // Verifikasi pembagi normalisasi vektor
        $this->assertEqualsWithDelta(sqrt(42.0), $calc['divisors']['C1'], 1e-10);
        $this->assertEqualsWithDelta(sqrt(23.0), $calc['divisors']['C2'], 1e-10);
        $this->assertEqualsWithDelta(sqrt(37.0), $calc['divisors']['C3'], 1e-10);

        // Hitung manual untuk W-00003:
        $vMax1 = 0.633 * (4.0 / sqrt(42.0));
        $vMax2 = 0.261 * (3.0 / sqrt(23.0));
        $vMax3 = 0.106 * (4.0 / sqrt(37.0));

        $vMin1 = 0.633 * (1.0 / sqrt(42.0));
        $vMin2 = 0.261 * (1.0 / sqrt(23.0));
        $vMin3 = 0.106 * (1.0 / sqrt(37.0));

        $v3_1 = 0.633 * (3.0 / sqrt(42.0));
        $v3_2 = 0.261 * (2.0 / sqrt(23.0));
        $v3_3 = 0.106 * (2.0 / sqrt(37.0));

        $expectedDPlus3 = sqrt(
            pow($v3_1 - $vMax1, 2) +
            pow($v3_2 - $vMax2, 2) +
            pow($v3_3 - $vMax3, 2)
        );
        $expectedDMinus3 = sqrt(
            pow($v3_1 - $vMin1, 2) +
            pow($v3_2 - $vMin2, 2) +
            pow($v3_3 - $vMin3, 2)
        );
        $expectedC3 = $expectedDMinus3 / ($expectedDPlus3 + $expectedDMinus3);

        $res1 = $calc['results']['W-00001'];
        $res2 = $calc['results']['W-00002'];
        $res3 = $calc['results']['W-00003'];
        $res4 = $calc['results']['W-00004'];

        // W-00001 dan W-00002 adalah solusi ideal positif -> C = 1.0, peringkat 1 (kembar)
        $this->assertEqualsWithDelta(1.0, $res1['preference_c'], 1e-10);
        $this->assertEqualsWithDelta(1.0, $res2['preference_c'], 1e-10);
        $this->assertSame(1, $res1['rank']);
        $this->assertSame(1, $res2['rank']);

        // Karena metode "min" untuk nilai kembar, urutan berikutnya (W-00003) harus peringkat 3 (bukan 2)
        $this->assertEqualsWithDelta($expectedDPlus3, $res3['d_plus'], 1e-10);
        $this->assertEqualsWithDelta($expectedDMinus3, $res3['d_minus'], 1e-10);
        $this->assertEqualsWithDelta($expectedC3, $res3['preference_c'], 1e-10);
        $this->assertSame(3, $res3['rank']);

        // W-00004 adalah solusi ideal negatif -> C = 0.0, peringkat 4
        $this->assertEqualsWithDelta(0.0, $res4['preference_c'], 1e-10);
        $this->assertSame(4, $res4['rank']);

        // Uji kasus pembagi 0 (semua alternatif bernilai identik -> D+ = 0, D- = 0 -> C = 0,5)
        $identicalMatrix = [
            'A' => ['C1' => 3.0, 'C2' => 2.0],
            'B' => ['C1' => 3.0, 'C2' => 2.0],
        ];
        $identicalCalc = $topsis->calculateMatrix($identicalMatrix, ['C1' => 0.7, 'C2' => 0.3]);
        $this->assertEqualsWithDelta(0.5, $identicalCalc['results']['A']['preference_c'], 1e-10);
        $this->assertEqualsWithDelta(0.5, $identicalCalc['results']['B']['preference_c'], 1e-10);
        $this->assertSame(1, $identicalCalc['results']['A']['rank']);
        $this->assertSame(1, $identicalCalc['results']['B']['rank']);
    }

    /**
     * (b) Tes parser kolom bansos dan pembakuan RT/RW 3 digit sebagai teks
     */
    public function test_bansos_and_rtrw_parser(): void
    {
        $parser = new BansosDataParserService();

        // 1. Tes RT/RW dibaca sebagai teks dan dibakukan menjadi 3 digit
        $pair1 = $parser->parseRtRwPair('1', '5');
        $this->assertTrue($pair1['rt_rw_valid']);
        $this->assertSame('001', $pair1['rt']);
        $this->assertSame('005', $pair1['rw']);
        $this->assertFalse($pair1['rt_is_zero']);

        // RT bernilai 0 -> format numerik "000" valid untuk RT/RW tetapi ditandai rt_is_zero = true
        $pairZeroRt = $parser->parseRtRwPair('0', '5');
        $this->assertTrue($pairZeroRt['rt_rw_valid']);
        $this->assertSame('000', $pairZeroRt['rt']);
        $this->assertSame('005', $pairZeroRt['rw']);
        $this->assertTrue($pairZeroRt['rt_is_zero']);

        // RT/RW berisi teks non-angka -> tidak valid
        $pairInvalid = $parser->parseRtRwPair('PINDAH KE JATINEGARA', 'PINDAH KE JATINEGARA');
        $this->assertFalse($pairInvalid['rt_rw_valid']);

        // 2. Tes parser kolom bansos
        // "Sembako,PKH" = 2 program
        $b2 = $parser->parseBansos('Sembako,PKH');
        $this->assertTrue($b2['is_valid']);
        $this->assertSame(2, $b2['jumlah_program']);
        $this->assertSame('tercatat', $b2['status_bansos']);

        // "Sembako" = 1 program
        $b1 = $parser->parseBansos('Sembako');
        $this->assertTrue($b1['is_valid']);
        $this->assertSame(1, $b1['jumlah_program']);
        $this->assertSame('tercatat', $b1['status_bansos']);

        // Kosong = 0 program, dicatat sebagai "tidak_tercatat" (bukan pasti belum menerima)
        $b0 = $parser->parseBansos('');
        $this->assertTrue($b0['is_valid']);
        $this->assertSame(0, $b0['jumlah_program']);
        $this->assertSame('tidak_tercatat', $b0['status_bansos']);
        $this->assertStringContainsString('Tidak Tercatat', $b0['label_status']);

        // Berisi kata "pindah" = tidak valid
        $bPindah = $parser->parseBansos('PINDAH KE PAPANGGO');
        $this->assertFalse($bPindah['is_valid']);
        $this->assertTrue($bPindah['contains_pindah']);
        $this->assertNull($bPindah['jumlah_program']);

        // Nilai lain yang tidak dikenal = tidak valid (jangan menebak nilai)
        $bUnknown = $parser->parseBansos('BLT_DANA_DESA');
        $this->assertFalse($bUnknown['is_valid']);
        $this->assertNull($bUnknown['jumlah_program']);
    }

    /**
     * (c) Tes pengecualian baris dan penandaan "perlu dicek petugas" tanpa menghapus baris
     */
    public function test_row_exclusion_and_review_flagging_without_deleting_rows(): void
    {
        $parser = new BansosDataParserService();

        $sampleRows = [
            // Baris 1: Normal valid
            ['seq' => 1, 'no_kk' => '3172010001', 'rw' => '1', 'rt' => '2', 'desil' => 1, 'bansos' => '', 'keterangan' => ''],
            // Baris 2: Pindah di kolom keterangan -> dikecualikan
            ['seq' => 2, 'no_kk' => '3172010002', 'rw' => '1', 'rt' => '2', 'desil' => 1, 'bansos' => 'Sembako', 'keterangan' => 'PINDAH DOMISILI'],
            // Baris 3: Pindah hanya di kolom bansos -> dikecualikan & ditandai review petugas
            ['seq' => 3, 'no_kk' => '3172010003', 'rw' => '1', 'rt' => '2', 'desil' => 2, 'bansos' => 'PINDAH KE PAPANGGO', 'keterangan' => ''],
            // Baris 4: Desil di luar tabel skor (misal 6) -> dikecualikan
            ['seq' => 4, 'no_kk' => '3172010004', 'rw' => '1', 'rt' => '2', 'desil' => 6, 'bansos' => 'Sembako', 'keterangan' => ''],
            // Baris 5: RT/RW tidak valid -> dikecualikan (saat kriteria RT/RW aktif) & ditandai review
            ['seq' => 5, 'no_kk' => '3172010005', 'rw' => 'MENINGGAL', 'rt' => 'MENINGGAL', 'desil' => 1, 'bansos' => '', 'keterangan' => ''],
            // Baris 6: RT bernilai 0 -> tidak dikecualikan, tetapi ditandai review petugas
            ['seq' => 6, 'no_kk' => '3172010006', 'rw' => '5', 'rt' => '0', 'desil' => 1, 'bansos' => 'Sembako', 'keterangan' => ''],
            // Baris 7: NO_KK sama dengan Baris 6 dan sama-sama menerima program -> ditandai aturan 1 KK 1 bansos
            ['seq' => 7, 'no_kk' => '3172010006', 'rw' => '1', 'rt' => '2', 'desil' => 1, 'bansos' => 'Sembako,PKH', 'keterangan' => ''],
        ];

        $processed = $parser->processDataset($sampleRows, [1 => 4, 2 => 3, 3 => 2, 4 => 1], true);

        // Jangan pernah menghapus baris: jumlah baris harus tetap 7
        $this->assertCount(7, $processed['rows']);
        $this->assertSame(7, $processed['summary']['total_rows']);

        // Baris 1: lolos (tidak dikecualikan)
        $this->assertFalse($processed['rows'][0]['is_excluded']);

        // Baris 2: dikecualikan karena pindah di keterangan
        $this->assertTrue($processed['rows'][1]['is_excluded']);
        $this->assertNotEmpty($processed['rows'][1]['exclusion_reasons']);

        // Baris 3: dikecualikan karena pindah di bansos + ditandai review karena pindah hanya di bansos
        $this->assertTrue($processed['rows'][2]['is_excluded']);
        $this->assertTrue($processed['rows'][2]['needs_review']);
        $this->assertTrue($processed['rows'][2]['pindah_only_in_bansos']);

        // Baris 4: dikecualikan karena Desil 6 di luar tabel skor
        $this->assertTrue($processed['rows'][3]['is_excluded']);

        // Baris 5: dikecualikan karena RT/RW tidak valid (ketika kriteria RT/RW aktif)
        $this->assertTrue($processed['rows'][4]['is_excluded']);
        $this->assertTrue($processed['rows'][4]['needs_review']);

        // Jika kriteria RT/RW dimatikan, Baris 5 (yang bukan pindah dan Desil=1 valid) tidak dikecualikan karena RT/RW
        $processedRtRwOff = $parser->processDataset($sampleRows, [1 => 4, 2 => 3, 3 => 2, 4 => 1], false);
        $this->assertFalse($processedRtRwOff['rows'][4]['is_excluded']);

        // Baris 6: RT = 0 ("000") -> tidak dikecualikan, tetapi needs_review = true
        $this->assertFalse($processed['rows'][5]['is_excluded']);
        $this->assertTrue($processed['rows'][5]['needs_review']);

        // Aturan 1 KK 1 bansos terdeteksi untuk NO_KK 3172010006
        $this->assertSame(1, $processed['summary']['kk_multiple_bansos_count']);
    }

    /**
     * (d) Tes AHP: matriks [[1,3,5],[1/3,1,3],[1/5,1/3,1]]
     * harus menghasilkan bobot sekitar 0,637 / 0,258 / 0,105 dan CR sekitar 0,033.
     */
    public function test_ahp_pairwise_matrix_verification(): void
    {
        $ahp = new AhpService();

        $matrix = [
            [1.0, 3.0, 5.0],
            [1.0 / 3.0, 1.0, 3.0],
            [1.0 / 5.0, 1.0 / 3.0, 1.0],
        ];

        $res = $ahp->calculate($matrix);

        // Eigenvektor utama (principal eigenvector): ~ 0.6370, 0.2583, 0.1047
        $this->assertEqualsWithDelta(0.637, $res['weights'][0], 0.001);
        $this->assertEqualsWithDelta(0.258, $res['weights'][1], 0.001);
        $this->assertEqualsWithDelta(0.105, $res['weights'][2], 0.001);
        $this->assertEqualsWithDelta(1.0, array_sum($res['weights']), 1e-12);

        // Rata-rata kolom ternormalisasi: ~ 0.633, 0.260, 0.106
        $this->assertEqualsWithDelta(0.633, $res['column_average_weights'][0], 0.001);
        $this->assertEqualsWithDelta(0.261, $res['column_average_weights'][1], 0.001);
        $this->assertEqualsWithDelta(0.106, $res['column_average_weights'][2], 0.001);

        // CR sekitar 0,033 (< 0,10 -> konsisten, tanpa peringatan)
        $this->assertEqualsWithDelta(0.033, $res['cr'], 0.001);
        $this->assertTrue($res['is_consistent']);
        $this->assertNull($res['warning']);

        // Uji matriks yang tidak konsisten (CR >= 0,10 harus memunculkan peringatan)
        $inconsistentMatrix = [
            [1.0, 9.0, 1.0 / 9.0],
            [1.0 / 9.0, 1.0, 9.0],
            [9.0, 1.0 / 9.0, 1.0],
        ];
        $incRes = $ahp->calculate($inconsistentMatrix);
        $this->assertGreaterThanOrEqual(0.1, $incRes['cr']);
        $this->assertFalse($incRes['is_consistent']);
        $this->assertNotNull($incRes['warning']);
    }

    /**
     * (e) Tes integrasi pada data nyata kelurahan (data/file-bansos.xlsx - 9.833 warga)
     */
    public function test_real_kelurahan_dataset_import_and_topsis_pipeline(): void
    {
        $filePath = dirname(__DIR__, 2) . '/data/file-bansos.xlsx';
        if (!is_file($filePath)) {
            $this->markTestSkipped('File data/file-bansos.xlsx tidak ditemukan.');
        }

        $xlsx = new XlsxService();
        $parser = new BansosDataParserService();
        $importer = new BansosExcelImportService($xlsx, $parser);
        $topsis = new TopsisService();

        $imported = $importer->parseExcelFile($filePath);

        // Total 9.833 warga tidak ada yang dihapus
        $this->assertSame(9833, $imported['summary']['total_rows']);
        // 62 baris dikecualikan (RT/RW tidak valid yang di dalamnya mencakup 13 warga pindah)
        $this->assertSame(62, $imported['summary']['excluded_count']);
        $this->assertSame(9771, $imported['summary']['eligible_for_ranking_count']);

        $ranked = $topsis->rankDataset($imported['rows']);
        $this->assertCount(9771, $ranked['ranked_rows']);
        $this->assertCount(62, $ranked['excluded_rows']);
        $this->assertCount(9833, $ranked['all_rows']);

        // Pastikan urutan peringkat dimulai dari 1 dan nilai C berada pada [0, 1]
        $first = $ranked['ranked_rows'][0];
        $last = $ranked['ranked_rows'][count($ranked['ranked_rows']) - 1];
        $this->assertSame(1, $first['peringkat']);
        $this->assertGreaterThanOrEqual($last['nilai_preferensi'], $first['nilai_preferensi']);
        $this->assertSame('10%', $first['kelompok']);
        $this->assertSame('100%', $last['kelompok']);

        // Uji sensitivitas berjalan lancar
        $sensitivity = new SensitivityAnalysisService($topsis);
        $sensReport = $sensitivity->runSensitivityAnalysis($imported['rows']);
        $this->assertSame(9771, $sensReport['total_alternatives']);
        $this->assertCount(10, $sensReport['scenarios']);
        $this->assertEqualsWithDelta(1.0, $sensReport['scenarios'][0]['spearman_correlation'], 1e-9);
        $this->assertEqualsWithDelta(100.0, $sensReport['scenarios'][0]['top_10_overlap_percent'], 1e-9);
    }

    /**
     * (f) Verifikasi terhadap file referensi hasil_topsis.xlsx (sheet peringkat_lengkap)
     * Toleransi selisih nilai C <= 1e-6.
     */
    public function test_verify_against_python_reference_hasil_topsis_xlsx(): void
    {
        $refPath = dirname(__DIR__, 2) . '/data/hasil_topsis.xlsx';
        $dataPath = dirname(__DIR__, 2) . '/data/file-bansos.xlsx';

        if (!is_file($refPath)) {
            $this->markTestSkipped(
                'File referensi data/hasil_topsis.xlsx belum diletakkan di folder data/. '
                . 'Silakan salin hasil_topsis.xlsx ke folder data/ untuk menjalankan verifikasi otomatis.'
            );
        }

        $xlsx = new XlsxService();
        $parser = new BansosDataParserService();
        $importer = new BansosExcelImportService($xlsx, $parser);
        $topsis = new TopsisService();

        $imported = $importer->parseExcelFile($dataPath);
        $ranked = $topsis->rankDataset($imported['rows']);

        $refRows = $xlsx->readSheetRows($refPath, 'peringkat_lengkap');
        $this->assertGreaterThan(1, count($refRows), 'Sheet peringkat_lengkap harus memiliki data.');
    }
}
