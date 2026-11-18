<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HasilSAW extends Model
{
    protected $guarded = [];

    protected $casts = [
        'nilaiPerKriteria' => 'array',
        'normalisasi' => 'array',
        'skor_desil' => 'float',
        'skor_bansos' => 'float',
        'skor_rtrw' => 'float',
        'd_plus' => 'float',
        'd_minus' => 'float',
        'nilai_preferensi' => 'float',
        'nilaiAkhir' => 'float',
        'persentase_kumulatif' => 'float',
        'ranking' => 'integer',
    ];

    public function masyarakat()
    {
        return $this->belongsTo(Masyarakat::class);
    }

    public function jenisBantuan()
    {
        return $this->belongsTo(JenisBantuan::class, 'jenis_bantuan_id');
    }

    public function klaimBantuan()
    {
        return $this->hasOne(KlaimBantuan::class, 'hasil_saw_id');
    }
}
