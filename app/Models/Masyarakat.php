<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Masyarakat extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'rt_rw_valid' => 'boolean',
        'is_pindah' => 'boolean',
        'is_excluded' => 'boolean',
        'exclusion_reasons' => 'array',
        'needs_review' => 'boolean',
        'review_reasons' => 'array',
        'desil' => 'integer',
        'jumlah_program' => 'integer',
        'excel_row_number' => 'integer',
        'usia' => 'integer',
    ];

    public function sanggahans()
    {
        return $this->hasMany(Sanggahan::class, 'warga_dilaporkan_id');
    }

    public function jenisBantuan()
    {
        return $this->belongsTo(JenisBantuan::class);
    }

    public function editLogs()
    {
        return $this->hasMany(WargaEditLog::class, 'masyarakat_id')->latest();
    }

    /**
     * Relasi ke master data warga (individu).
     */
    public function warga()
    {
        return $this->belongsTo(Warga::class);
    }

    /**
     * Relasi ke master data keluarga (KK).
     */
    public function keluarga()
    {
        return $this->belongsTo(Keluarga::class);
    }
}
