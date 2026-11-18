<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Kriteria extends Model
{
    protected $guarded = [];

    protected $casts = [
        'bobot_ahp' => 'float',
        'is_active' => 'boolean',
        'skor_map' => 'array',
    ];
}
