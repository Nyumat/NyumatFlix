// Signalsmith Stretch C wrapper — exposes a sync feed/process API to JS so the
// existing AudioRenderer pipeline (pre-stretch chunks before scheduling) can
// drop it in alongside SoundTouch. Compiled into the same WASM module as the
// FFmpeg/dav1d core, so there's no second WASM file to fetch.
//
// Signalsmith's native API is process(in, nIn, out, nOut) — the in:out ratio
// implicitly sets the time-stretch factor. We expose that directly: callers
// pass interleaved Float32 buffers from JS, we de-interleave to planar
// scratch, run the stretcher, and re-interleave on the way out.

#include "signalsmith-stretch/signalsmith-stretch.h"
#include <emscripten.h>
#include <unordered_map>
#include <memory>
#include <vector>

namespace {

struct StretchInstance {
    signalsmith::stretch::SignalsmithStretch<float> stretch;
    int channels;
    // Scratch buffers reused across process() calls — grow as needed.
    std::vector<std::vector<float>> planarIn;
    std::vector<std::vector<float>> planarOut;
    std::vector<float *> inPtrs;
    std::vector<float *> outPtrs;

    StretchInstance(int ch, float sampleRate) : channels(ch) {
        stretch.presetDefault(ch, sampleRate);
        planarIn.resize(ch);
        planarOut.resize(ch);
        inPtrs.resize(ch);
        outPtrs.resize(ch);
    }
};

std::unordered_map<int, std::unique_ptr<StretchInstance>> &instances() {
    static std::unordered_map<int, std::unique_ptr<StretchInstance>> m;
    return m;
}

int nextHandle() {
    static int h = 0;
    return ++h;
}

} // anonymous

extern "C" {

EMSCRIPTEN_KEEPALIVE
int movi_stretch_new(int channels, float sampleRate) {
    int h = nextHandle();
    instances()[h] = std::make_unique<StretchInstance>(channels, sampleRate);
    return h;
}

EMSCRIPTEN_KEEPALIVE
void movi_stretch_delete(int handle) {
    instances().erase(handle);
}

EMSCRIPTEN_KEEPALIVE
void movi_stretch_reset(int handle) {
    auto it = instances().find(handle);
    if (it != instances().end()) it->second->stretch.reset();
}

// Pitch shift in semitones; 0 = pitch-preserving (the time-stretch case).
EMSCRIPTEN_KEEPALIVE
void movi_stretch_set_transpose_semitones(int handle, float semitones) {
    auto it = instances().find(handle);
    if (it != instances().end()) {
        it->second->stretch.setTransposeSemitones(semitones);
    }
}

EMSCRIPTEN_KEEPALIVE
int movi_stretch_input_latency(int handle) {
    auto it = instances().find(handle);
    return (it != instances().end()) ? it->second->stretch.inputLatency() : 0;
}

EMSCRIPTEN_KEEPALIVE
int movi_stretch_output_latency(int handle) {
    auto it = instances().find(handle);
    return (it != instances().end()) ? it->second->stretch.outputLatency() : 0;
}

// Sync time-stretch. inFrames input → outFrames output, both interleaved.
// Time-stretch factor is implicit in the ratio: inFrames:outFrames == 1:1 is
// unity, 1:2 is 0.5× speed (slow), 2:1 is 2× speed (fast).
EMSCRIPTEN_KEEPALIVE
void movi_stretch_process(int handle,
                           const float *in, int inFrames,
                           float *out, int outFrames) {
    auto it = instances().find(handle);
    if (it == instances().end()) return;
    auto &inst = *it->second;
    const int channels = inst.channels;

    // De-interleave into planar scratch.
    for (int c = 0; c < channels; ++c) {
        if ((int)inst.planarIn[c].size() < inFrames) {
            inst.planarIn[c].resize(inFrames);
        }
        float *dst = inst.planarIn[c].data();
        for (int i = 0; i < inFrames; ++i) {
            dst[i] = in[i * channels + c];
        }
        inst.inPtrs[c] = dst;
    }

    // Ensure the output scratch is big enough.
    for (int c = 0; c < channels; ++c) {
        if ((int)inst.planarOut[c].size() < outFrames) {
            inst.planarOut[c].resize(outFrames);
        }
        inst.outPtrs[c] = inst.planarOut[c].data();
    }

    inst.stretch.process(inst.inPtrs, inFrames, inst.outPtrs, outFrames);

    // Interleave back out.
    for (int c = 0; c < channels; ++c) {
        const float *src = inst.planarOut[c].data();
        for (int i = 0; i < outFrames; ++i) {
            out[i * channels + c] = src[i];
        }
    }
}

} // extern "C"
