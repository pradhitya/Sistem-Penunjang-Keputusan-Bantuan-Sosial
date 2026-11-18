<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WargaEditLog extends Model
{
    protected $guarded = [];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    public function masyarakat()
    {
        return $this->belongsTo(Masyarakat::class);
    }
}
