<?php

namespace App\Services;

use RuntimeException;
use SimpleXMLElement;

class XlsxService
{
    /**
     * Read all entries from a ZIP archive (.xlsx) using pure PHP + zlib.
     *
     * @return array<string, string>
     */
    public function readZipEntries(string $zipPath): array
    {
        if (!is_file($zipPath)) {
            throw new RuntimeException("File tidak ditemukan: {$zipPath}");
        }

        $data = @file_get_contents($zipPath);
        if ($data === false) {
            throw new RuntimeException("Gagal membaca file: {$zipPath}");
        }

        $eocdPos = strrpos($data, "PK\x05\x06");
        if ($eocdPos === false) {
            throw new RuntimeException("Format file bukan ZIP/XLSX yang valid.");
        }

        $eocd = unpack(
            'vdisk/vcdDisk/vcdEntriesDisk/vcdEntries/VcdSize/VcdOffset',
            substr($data, $eocdPos + 4, 16)
        );

        $pos = $eocd['cdOffset'];
        $entries = [];

        for ($i = 0; $i < $eocd['cdEntries']; $i++) {
            if (substr($data, $pos, 4) !== "PK\x01\x02") {
                break;
            }
            $hdr = unpack(
                'vverMade/vverNeed/vflag/vmethod/vtime/vdate/Vcrc/VcompSize/VuncompSize/vnameLen/vextraLen/vcommentLen/vdiskStart/vintAttr/VextAttr/VlocalOffset',
                substr($data, $pos + 4, 42)
            );
            $name = substr($data, $pos + 46, $hdr['nameLen']);
            $pos += 46 + $hdr['nameLen'] + $hdr['extraLen'] + $hdr['commentLen'];

            $lPos = $hdr['localOffset'];
            $lHdr = unpack(
                'vverNeed/vflag/vmethod/vtime/vdate/Vcrc/VcompSize/VuncompSize/vnameLen/vextraLen',
                substr($data, $lPos + 4, 26)
            );
            $contentPos = $lPos + 30 + $lHdr['nameLen'] + $lHdr['extraLen'];
            $compData = substr($data, $contentPos, $hdr['compSize']);

            if ($hdr['method'] === 0) {
                $entries[$name] = $compData;
            } elseif ($hdr['method'] === 8) {
                $inflated = @gzinflate($compData);
                if ($inflated === false) {
                    throw new RuntimeException("Gagal mengekstrak entri ZIP: {$name}");
                }
                $entries[$name] = $inflated;
            }
        }

        return $entries;
    }

    /**
     * Read a sheet from an .xlsx file.
     * Returns array of ['excel_row' => int, 'cells' => ['A' => string, 'B' => string, ...]]
     */
    public function readSheetRows(string $xlsxPath, ?string $sheetName = null): array
    {
        $entries = $this->readZipEntries($xlsxPath);

        // Parse sharedStrings.xml if available
        $sharedStrings = [];
        if (isset($entries['xl/sharedStrings.xml'])) {
            $ss = new SimpleXMLElement($entries['xl/sharedStrings.xml']);
            foreach ($ss->si as $si) {
                if (isset($si->t)) {
                    $sharedStrings[] = (string) $si->t;
                } else {
                    $txt = '';
                    foreach ($si->r as $r) {
                        $txt .= (string) $r->t;
                    }
                    $sharedStrings[] = $txt;
                }
            }
        }

        // Resolve target worksheet path
        $targetSheetPath = 'xl/worksheets/sheet1.xml';
        if ($sheetName !== null && isset($entries['xl/workbook.xml'])) {
            $wb = new SimpleXMLElement($entries['xl/workbook.xml']);
            $rId = null;
            foreach ($wb->sheets->sheet as $s) {
                if (strcasecmp((string) $s['name'], $sheetName) === 0) {
                    $attrs = $s->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships');
                    $rId = (string) ($attrs['id'] ?? '');
                    break;
                }
            }
            if ($rId && isset($entries['xl/_rels/workbook.xml.rels'])) {
                $rels = new SimpleXMLElement($entries['xl/_rels/workbook.xml.rels']);
                foreach ($rels->Relationship as $rel) {
                    if ((string) $rel['Id'] === $rId) {
                        $target = ltrim((string) $rel['Target'], '/');
                        if (!str_starts_with($target, 'xl/')) {
                            $target = 'xl/' . $target;
                        }
                        if (isset($entries[$target])) {
                            $targetSheetPath = $target;
                        }
                        break;
                    }
                }
            }
        }

        if (!isset($entries[$targetSheetPath])) {
            throw new RuntimeException("Worksheet tidak ditemukan: {$targetSheetPath}");
        }

        $sheet = new SimpleXMLElement($entries[$targetSheetPath]);
        $rows = [];

        foreach ($sheet->sheetData->row as $row) {
            $rNum = (int) $row['r'];
            $cells = [];
            foreach ($row->c as $c) {
                $ref = (string) $c['r'];
                $col = preg_replace('/[0-9]/', '', $ref);
                $type = (string) $c['t'];
                $v = isset($c->v) ? (string) $c->v : '';

                if ($type === 's' && $v !== '') {
                    $v = $sharedStrings[(int) $v] ?? $v;
                } elseif ($type === 'inlineStr' && isset($c->is->t)) {
                    $v = (string) $c->is->t;
                }

                $cells[$col] = $v;
            }
            $rows[] = [
                'excel_row' => $rNum,
                'row_number' => $rNum,
                'cells' => $cells,
            ];
        }

        return $rows;
    }

    /**
     * Baca sheet pertama dari file .xlsx beserta nama sheet-nya.
     *
     * @return array{sheet_name: string, rows: array<int, array{excel_row: int, row_number: int, cells: array<string, string>}>}
     */
    public function readFirstSheet(string $xlsxPath): array
    {
        $entries = $this->readZipEntries($xlsxPath);
        $firstSheetName = 'Sheet1';
        if (isset($entries['xl/workbook.xml'])) {
            $wb = new SimpleXMLElement($entries['xl/workbook.xml']);
            if (isset($wb->sheets->sheet[0]['name'])) {
                $firstSheetName = (string) $wb->sheets->sheet[0]['name'];
            }
        }

        return [
            'sheet_name' => $firstSheetName,
            'rows' => $this->readSheetRows($xlsxPath, null),
        ];
    }

    /**
     * Build a binary .xlsx file in memory from headers and 2D array of rows.
     *
     * @param array<int, string> $headers
     * @param array<int, array<int, string|int|float|null>> $rows
     */
    public function generateXlsx(array $headers, array $rows, string $sheetName = 'Hasil_Prioritas'): string
    {
        $sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetData>';

        $allRows = array_merge([$headers], $rows);
        foreach ($allRows as $rIdx => $rowValues) {
            $rowNum = $rIdx + 1;
            $sheetXml .= '<row r="' . $rowNum . '">';
            foreach (array_values($rowValues) as $cIdx => $val) {
                $colLetter = $this->columnIndexToLetter($cIdx);
                $cellRef = $colLetter . $rowNum;
                if ($rIdx > 0 && (is_int($val) || is_float($val))) {
                    $sheetXml .= '<c r="' . $cellRef . '"><v>' . $val . '</v></c>';
                } else {
                    $escaped = htmlspecialchars((string) ($val ?? ''), ENT_XML1 | ENT_QUOTES, 'UTF-8');
                    $sheetXml .= '<c r="' . $cellRef . '" t="inlineStr"><is><t>' . $escaped . '</t></is></c>';
                }
            }
            $sheetXml .= '</row>';
        }

        $sheetXml .= '</sheetData></worksheet>';

        $safeSheetName = htmlspecialchars(substr($sheetName, 0, 31), ENT_XML1 | ENT_QUOTES, 'UTF-8');

        $files = [
            '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                . '<Default Extension="xml" ContentType="application/xml"/>'
                . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                . '</Types>',
            '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                . '</Relationships>',
            'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                . '<sheets><sheet name="' . $safeSheetName . '" sheetId="1" r:id="rId1"/></sheets>'
                . '</workbook>',
            'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
                . '</Relationships>',
            'xl/worksheets/sheet1.xml' => $sheetXml,
        ];

        return $this->buildZipArchive($files);
    }

    /**
     * Build a valid ZIP archive binary string from an array of filename => content.
     *
     * @param array<string, string> $files
     */
    private function buildZipArchive(array $files): string
    {
        $localParts = '';
        $centralDir = '';
        $offset = 0;
        $count = 0;

        foreach ($files as $name => $content) {
            $uncompSize = strlen($content);
            $crc = crc32($content);
            $compData = gzdeflate($content, 6);
            $compSize = strlen($compData);
            $nameLen = strlen($name);

            $localHeader = "PK\x03\x04"
                . pack('vvvvvVVVvv', 20, 0, 8, 0, 0, $crc, $compSize, $uncompSize, $nameLen, 0)
                . $name;

            $localParts .= $localHeader . $compData;

            $centralHeader = "PK\x01\x02"
                . pack('vvvvvvVVVvvvvvVV', 20, 20, 0, 8, 0, 0, $crc, $compSize, $uncompSize, $nameLen, 0, 0, 0, 0, 0, $offset)
                . $name;

            $centralDir .= $centralHeader;
            $offset += strlen($localHeader) + $compSize;
            $count++;
        }

        $eocd = "PK\x05\x06"
            . pack('vvvvVVv', 0, 0, $count, $count, strlen($centralDir), $offset, 0);

        return $localParts . $centralDir . $eocd;
    }

    private function columnIndexToLetter(int $index): string
    {
        $letter = '';
        while ($index >= 0) {
            $letter = chr(($index % 26) + 65) . $letter;
            $index = intdiv($index, 26) - 1;
        }
        return $letter;
    }
}
