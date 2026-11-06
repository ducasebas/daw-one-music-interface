/* Independently declared interoperability layout, not a Squeezelite implementation.
 * See docs/audio-analysis.md for source revision and ABI restrictions. */
#ifndef TUNEBOX_VIS_LAYOUT_H
#define TUNEBOX_VIS_LAYOUT_H
#include <pthread.h>
#include <stdbool.h>
#include <stdint.h>
#include <time.h>
#define TB_VIS_SAMPLES 16384
#define TB_PCM_FRAMES 4096
struct tb_vis_layout {
    pthread_rwlock_t producer_lock; /* Layout only. The reader NEVER touches this lock. */
    uint32_t sample_capacity;
    uint32_t next_sample;
    bool running;
    uint32_t sample_rate;
    time_t updated;
    int16_t samples[TB_VIS_SAMPLES];
};
#endif
