# Standards Compliance

Movi-Player follows ISO and international standards for maximum compatibility.

## Compliance Overview

| Component        | Status       | Key Standards                                        |
| ---------------- | ------------ | ---------------------------------------------------- |
| **Demuxer**      | ✅ Compliant | ISO/IEC 14496-14, ISO/IEC 14496-15                   |
| **Codec Parser** | ✅ Compliant | ISO/IEC 14496-15, ISO/IEC 23008-2, ITU-T H.264/H.265 |
| **Player**       | ✅ Compliant | WebCodecs API, Web Audio API                         |
| **Element**      | ✅ Compliant | HTML5 Custom Elements, WebGL2                        |
| **Renderer**     | ✅ Compliant | WebGL2, ITU-T Color Spaces                           |

## Container Format Standards

### ISO/IEC 14496-14 (MP4)

- Proper parsing of MP4 container structure via FFmpeg WASM
- Support for ftyp, moov, mdat boxes
- Correct track and sample table handling

### Matroska/WebM

- Full support for MKV container format
- EBML parsing through FFmpeg
- Multi-track audio/video/subtitle support
- VP8/VP9/AV1 codec support in WebM

## Codec String Formats

### HEVC (H.265) - ISO/IEC 14496-15

```
hvc1.{profileSpace}{profileIdc}.{compatibilityFlags}.{tier}{level}.{constraints}
```

Example: `hvc1.2.4.L153.B0`

- Profile 2 (Main 10)
- Compatibility: 0x4
- Tier: Low
- Level: 153 (5.1)

### AVC (H.264) - ISO/IEC 14496-15

```
avc1.{profile}{compatibility}{level}
```

Example: `avc1.640028`

- Profile: 0x64 (High Profile)
- Compatibility: 0x00
- Level: 0x28 (4.0)

### AV1 - AV1 Codec ISO Media File Format

```
av01.{profile}.{level}{tier}.{bitDepth}
```

Example: `av01.0.01M.08`

- Profile: 0 (Main)
- Level: 01 (2.1)
- Tier: M (Main)
- Bit Depth: 08 (8-bit)

### VP9 - VP Codec ISO Media File Format

```
vp09.{profile}.{level}.{bitDepth}.{chroma}.{primaries}.{transfer}.{matrix}.{range}
```

Example: `vp09.02.51.10.01.09.16.09.00`

- Profile: 02 (Profile 2, 10-bit)
- Level: 51 (5.1)
- Bit Depth: 10
- Chroma: 01 (4:2:0)
- Primaries: 09 (BT.2020)
- Transfer: 16 (SMPTE 2084 PQ)

## Color Space Standards

### ITU-T H.273 - Color Identification

#### Color Primaries

| Code | Name     | Description                  |
| ---- | -------- | ---------------------------- |
| 1    | bt709    | Rec. ITU-R BT.709-6 (HDTV)   |
| 9    | bt2020   | Rec. ITU-R BT.2020-2 (UHDTV) |
| 10   | bt2020   | Same as 9                    |
| 12   | smpte431 | DCI-P3                       |
| 22   | p3       | Display P3                   |

#### Transfer Characteristics

| Code | Name               | Description           |
| ---- | ------------------ | --------------------- |
| 1    | bt709              | Rec. ITU-R BT.709-6   |
| 15   | iec61966-2-1       | sRGB                  |
| 16   | bt2020-10          | BT.2020 10-bit        |
| 17   | bt2020-12          | BT.2020 12-bit        |
| 18   | pq / smpte2084     | SMPTE ST 2084 (HDR10) |
| 20   | hlg / arib-std-b67 | Hybrid Log-Gamma      |

#### Matrix Coefficients

| Code | Name       | Description                    |
| ---- | ---------- | ------------------------------ |
| 1    | bt709      | Rec. ITU-R BT.709-6            |
| 9    | bt2020-ncl | BT.2020 non-constant luminance |
| 10   | bt2020-cl  | BT.2020 constant luminance     |

## HDR Detection

Movi-Player uses multi-layered HDR detection:

1. **Metadata-first**: Uses explicit color space values from container
2. **4K Heuristic**: For UHD content (≥3840×2160), assumes HDR if metadata missing
3. **Profile-based**: HEVC Main10 profile indicates 10-bit content

```typescript
// HDR detection logic
const isHDRTransfer =
  transfer.includes("pq") ||
  transfer.includes("hlg") ||
  transfer.includes("smpte2084") ||
  transfer.includes("arib-std-b67");

const isBT2020 = primaries.includes("bt2020") || primaries.includes("rec2020");

videoTrack.isHDR = isHDRTransfer || isBT2020;
```

## Web Standards

### W3C WebCodecs API

- Proper use of `VideoDecoder` and `AudioDecoder` interfaces
- Correct codec string format per WebCodecs registry
- Hardware acceleration with software fallback

### W3C Web Audio API

- AudioContext for playback (master clock)
- Proper buffer scheduling and timing
- Sample rate conversion handling

### W3C Custom Elements v1

- Element name contains hyphen (`movi-player`)
- Shadow DOM encapsulation
- Lifecycle callbacks (connectedCallback, disconnectedCallback, attributeChangedCallback)
- Observed attributes declaration

### WHATWG HTMLMediaElement

Compatible properties:

- `src`, `poster`, `preload`, `crossorigin`
- `paused`, `ended`, `currentTime`, `duration`, `playbackRate`
- `play()`, `pause()`, `load()`
- `autoplay`, `loop`, `muted`, `controls`, `volume`

## Standards References

| Standard         | Full Name                      | Version           |
| ---------------- | ------------------------------ | ----------------- |
| ISO/IEC 14496-10 | H.264/AVC Video Coding         | Edition 11 (2020) |
| ISO/IEC 14496-12 | ISO Base Media File Format     | Edition 7 (2022)  |
| ISO/IEC 14496-14 | MP4 File Format                | Edition 2 (2020)  |
| ISO/IEC 14496-15 | Carriage of NAL in ISO         | Edition 5 (2022)  |
| ISO/IEC 23008-2  | HEVC Video Coding              | Edition 3 (2020)  |
| ITU-T H.264      | Advanced Video Coding          | 06/2019           |
| ITU-T H.265      | High Efficiency Video Coding   | 11/2019           |
| ITU-T H.273      | Coding-independent code points | 12/2016           |
| SMPTE ST 2084    | High Dynamic Range EOTF        | 2014              |
| ARIB STD-B67     | Hybrid Log-Gamma (HLG)         | 2015              |

## Verification

To verify standards compliance:

1. **Codec String Validation**

   ```typescript
   const support = await VideoDecoder.isConfigSupported({
     codec: "hvc1.2.4.L153.B0",
   });
   ```

2. **Color Space Accuracy**
   - Compare against MediaInfo/FFprobe output
   - Verify HDR content displays correctly

3. **Container Compatibility**
   - Test with standards-compliant MP4/MKV/WebM files
   - Verify against ISO reference software
