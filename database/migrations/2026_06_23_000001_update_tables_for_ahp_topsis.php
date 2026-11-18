<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kriterias', function (Blueprint $table) {
            if (!Schema::hasColumn('kriterias', 'bobot_ahp')) {
                $table->decimal('bobot_ahp', 10, 6)->default(0.333333)->after('bobot');
            }
            if (!Schema::hasColumn('kriterias', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('bobot_ahp');
            }
            if (!Schema::hasColumn('kriterias', 'skor_map')) {
                $table->json('skor_map')->nullable()->after('is_active');
            }
        });

        Schema::table('masyarakats', function (Blueprint $table) {
            if (!Schema::hasColumn('masyarakats', 'id_anonim')) {
                $table->string('id_anonim', 32)->nullable()->index()->after('id');
            }
            if (!Schema::hasColumn('masyarakats', 'excel_row_number')) {
                $table->integer('excel_row_number')->nullable()->index()->after('id_anonim');
            }
            if (!Schema::hasColumn('masyarakats', 'no_kk')) {
                $table->string('no_kk', 32)->nullable()->index()->after('nik');
            }
            if (!Schema::hasColumn('masyarakats', 'no_pbp')) {
                $table->string('no_pbp', 64)->nullable()->after('no_kk');
            }
            if (!Schema::hasColumn('masyarakats', 'tanggal_lahir')) {
                $table->string('tanggal_lahir', 32)->nullable()->after('nama');
            }
            if (!Schema::hasColumn('masyarakats', 'hubungan_keluarga')) {
                $table->string('hubungan_keluarga', 64)->nullable()->after('tanggal_lahir');
            }
            if (!Schema::hasColumn('masyarakats', 'usia')) {
                $table->integer('usia')->nullable()->after('hubungan_keluarga');
            }
            if (!Schema::hasColumn('masyarakats', 'rt')) {
                $table->string('rt', 64)->nullable()->index()->after('rtRw');
            }
            if (!Schema::hasColumn('masyarakats', 'rw')) {
                $table->string('rw', 64)->nullable()->index()->after('rt');
            }
            if (!Schema::hasColumn('masyarakats', 'rt_raw')) {
                $table->string('rt_raw', 128)->nullable()->after('rw');
            }
            if (!Schema::hasColumn('masyarakats', 'rw_raw')) {
                $table->string('rw_raw', 128)->nullable()->after('rt_raw');
            }
            if (!Schema::hasColumn('masyarakats', 'rt_rw_valid')) {
                $table->boolean('rt_rw_valid')->default(true)->after('rw_raw');
            }
            if (!Schema::hasColumn('masyarakats', 'desil')) {
                $table->integer('desil')->nullable()->index()->after('rt_rw_valid');
            }
            if (!Schema::hasColumn('masyarakats', 'bansos_raw')) {
                $table->string('bansos_raw', 128)->nullable()->after('desil');
            }
            if (!Schema::hasColumn('masyarakats', 'jumlah_program')) {
                $table->integer('jumlah_program')->default(0)->index()->after('bansos_raw');
            }
            if (!Schema::hasColumn('masyarakats', 'status_bansos')) {
                $table->string('status_bansos', 32)->default('tidak_tercatat')->after('jumlah_program');
            }
            if (!Schema::hasColumn('masyarakats', 'keterangan_raw')) {
                $table->text('keterangan_raw')->nullable()->after('status_bansos');
            }
            if (!Schema::hasColumn('masyarakats', 'is_pindah')) {
                $table->boolean('is_pindah')->default(false)->index()->after('keterangan_raw');
            }
            if (!Schema::hasColumn('masyarakats', 'is_excluded')) {
                $table->boolean('is_excluded')->default(false)->index()->after('is_pindah');
            }
            if (!Schema::hasColumn('masyarakats', 'exclusion_reasons')) {
                $table->json('exclusion_reasons')->nullable()->after('is_excluded');
            }
            if (!Schema::hasColumn('masyarakats', 'needs_review')) {
                $table->boolean('needs_review')->default(false)->index()->after('exclusion_reasons');
            }
            if (!Schema::hasColumn('masyarakats', 'review_reasons')) {
                $table->json('review_reasons')->nullable()->after('needs_review');
            }
        });

        Schema::table('hasil_s_a_w_s', function (Blueprint $table) {
            if (!Schema::hasColumn('hasil_s_a_w_s', 'skor_desil')) {
                $table->decimal('skor_desil', 10, 6)->nullable()->after('normalisasi');
            }
            if (!Schema::hasColumn('hasil_s_a_w_s', 'skor_bansos')) {
                $table->decimal('skor_bansos', 10, 6)->nullable()->after('skor_desil');
            }
            if (!Schema::hasColumn('hasil_s_a_w_s', 'skor_rtrw')) {
                $table->decimal('skor_rtrw', 10, 6)->nullable()->after('skor_bansos');
            }
            if (!Schema::hasColumn('hasil_s_a_w_s', 'd_plus')) {
                $table->decimal('d_plus', 14, 10)->nullable()->after('skor_rtrw');
            }
            if (!Schema::hasColumn('hasil_s_a_w_s', 'd_minus')) {
                $table->decimal('d_minus', 14, 10)->nullable()->after('d_plus');
            }
            if (!Schema::hasColumn('hasil_s_a_w_s', 'nilai_preferensi')) {
                $table->decimal('nilai_preferensi', 14, 10)->nullable()->index()->after('d_minus');
            }
            if (!Schema::hasColumn('hasil_s_a_w_s', 'persentase_kumulatif')) {
                $table->decimal('persentase_kumulatif', 8, 4)->nullable()->after('ranking');
            }
            if (!Schema::hasColumn('hasil_s_a_w_s', 'kelompok')) {
                $table->string('kelompok', 32)->nullable()->index()->after('persentase_kumulatif');
            }
            if (!Schema::hasColumn('hasil_s_a_w_s', 'kelompok_label')) {
                $table->string('kelompok_label', 64)->nullable()->after('kelompok');
            }
        });

        if (!Schema::hasTable('warga_edit_logs')) {
            Schema::create('warga_edit_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('masyarakat_id')->constrained('masyarakats')->cascadeOnDelete();
                $table->string('id_anonim', 32)->nullable();
                $table->integer('excel_row_number')->nullable();
                $table->string('edited_by', 128);
                $table->text('reason');
                $table->json('old_values')->nullable();
                $table->json('new_values')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('warga_edit_logs');
    }
};
