import { Logger } from "../utils/Logger";

const TAG = "CodecParser";
class BitReader {
  private data: Uint8Array;
  private byteOffset: number = 0;
  private bitOffset: number = 0;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  readBits(n: number): number {
    let res = 0;
    for (let i = 0; i < n; i++) {
      res = res * 2 + this.readBit();
    }
    return res;
  }

  readBit(): number {
    if (this.byteOffset >= this.data.length) return 0;

    const bit = (this.data[this.byteOffset] >> (7 - this.bitOffset)) & 1;

    this.bitOffset++;
    if (this.bitOffset === 8) {
      this.bitOffset = 0;
      this.byteOffset++;
    }

    return bit;
  }

  skipBits(n: number): void {
    const totalBits = this.byteOffset * 8 + this.bitOffset + n;
    this.byteOffset = Math.floor(totalBits / 8);
    this.bitOffset = totalBits % 8;
  }
}

export interface ColorSpaceInfo {
  colorPrimaries?: string;
  colorTransfer?: string;
  colorSpace?: string;
}

export class CodecParser {
  static getCodecString(
    codec: string,
    extradata?: Uint8Array,
    width?: number,
    height?: number,
  ): string | null {
    Logger.debug(TAG, `Extradata: ${extradata?.length}`);

    if (!extradata || extradata.length === 0) {
      // Common case for some containers, but worth nothing if debugging
      return null;
    }

    const codecLower = codec.toLowerCase();

    if (
      codecLower === "hevc" ||
      codecLower === "h265" ||
      codecLower === "hvc1" ||
      codecLower === "hev1"
    ) {
      return this.getHevcCodecString(extradata, width, height);
    }

    if (codecLower === "av1" || codecLower === "av01") {
      return this.getAv1CodecString(extradata);
    }

    if (codecLower === "vp9" || codecLower === "vp09") {
      return this.getVp9CodecString(extradata);
    }

    if (codecLower === "h264" || codecLower === "avc1") {
      return this.getAvcCodecString(extradata);
    }

    if (codecLower === "vp8") {
      return this.getVp8CodecString(extradata);
    }

    if (
      codecLower === "vvc" ||
      codecLower === "vvc1" ||
      codecLower === "vvi1"
    ) {
      return this.getVvcCodecString(extradata);
    }

    return null;
  }

  /**
   * Extract color space information from codec extradata
   */
  static getColorSpaceInfo(
    codec: string,
    extradata?: Uint8Array,
    width?: number,
    height?: number,
  ): ColorSpaceInfo | null {
    // If extradata is missing, revert to strong heuristics
    if (!extradata || extradata.length === 0) {
      // Heuristic: 4K UHD content is overwhelmingly likely to be HDR (BT.2020/PQ)
      if (width && height && width >= 3840 && height >= 2160) {
        Logger.info(
          TAG,
          `4K UHD content detected (${width}x${height}), assuming HDR with BT.2020/PQ`,
        );
        return {
          colorPrimaries: "bt2020",
          colorTransfer: "smpte2084", // PQ (HDR10)
          colorSpace: "bt2020-ncl",
        };
      }
      return null;
    }

    const codecLower = codec.toLowerCase();

    if (
      codecLower === "hevc" ||
      codecLower === "h265" ||
      codecLower === "hvc1" ||
      codecLower === "hev1"
    ) {
      return this.getHevcColorSpaceInfo(extradata, width, height);
    }

    if (codecLower === "vp9" || codecLower === "vp09") {
      return this.getVp9ColorSpaceInfo(extradata);
    }

    return null;
  }

  private static getHevcCodecString(
    data: Uint8Array,
    width?: number,
    height?: number,
  ): string | null {
    if (data.length < 23) {
      Logger.warn(TAG, `HEVC extradata too small: ${data.length} (needed 23)`);
      return null;
    }

    // Log first 24 bytes for debugging to compare with C parser expectations
    Logger.debug(
      TAG,
      `HEVC Extradata: ${Array.from(data.slice(0, 24))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")}`,
    );

    // Check for Annex B start code (00 00 01 or 00 00 00 01)
    if (
      (data[0] === 0 && data[1] === 0 && data[2] === 1) ||
      (data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1)
    ) {
      if (width && height && width >= 3840 && height >= 2160) {
        // Heuristic: 4K Annex B is likely Main10 HDR
        // Return a compatible string: Main10 (2), High Tier (4), Level 5.1 (153)
        // hvc1.2.4.L153.B0
        Logger.info(
          TAG,
          "HEVC Annex B detected for 4K content. Using heuristic HDR codec string.",
        );
        return "hvc1.2.4.L153.B0";
      }

      Logger.warn(
        TAG,
        "HEVC extradata appears to be Annex B (NAL units), not hvcC. Skipping parser.",
      );
      return null;
    }

    const reader = new BitReader(data);

    // HEVC decoder configuration record
    // configurationVersion (8 bits)
    reader.skipBits(8);

    // general_profile_space (2)
    const generalProfileSpace = reader.readBits(2);
    // general_tier_flag (1)
    const generalTierFlag = reader.readBits(1);
    // general_profile_idc (5)
    const generalProfileIdc = reader.readBits(5);

    // general_profile_compatibility_flags (32)
    const generalProfileCompatibilityFlags = reader.readBits(32);

    // general_constraint_indicator_flags (48)
    const constraintBytes: number[] = [];
    for (let i = 0; i < 6; i++) {
      constraintBytes.push(reader.readBits(8));
    }

    // general_level_idc (8)
    const generalLevelIdc = reader.readBits(8);

    let profileSpace = "";
    switch (generalProfileSpace) {
      case 1:
        profileSpace = "A";
        break;
      case 2:
        profileSpace = "B";
        break;
      case 3:
        profileSpace = "C";
        break;
    }

    // Reconstruct compatibility flags for display (reverse bits)
    let rev = 0;
    let src = generalProfileCompatibilityFlags;
    for (let i = 0; i < 32; i++) {
      rev = rev * 2 + (src & 1);
      src = Math.floor(src / 2);
    }

    // Use unsigned right shift to ensure we treat it as u32
    const compatStr = (rev >>> 0).toString(16);

    const tierStr = generalTierFlag === 0 ? "L" : "H";

    let str = `hvc1.${profileSpace}${generalProfileIdc}.${compatStr}.${tierStr}${generalLevelIdc}`;

    let hasByte = false;
    for (let i = 5; i >= 0; i--) {
      const byte = constraintBytes[i];
      if (byte !== 0 || hasByte) {
        str += "." + byte.toString(16);
        hasByte = true;
      }
    }

    Logger.debug(TAG, `HEVC codec string: ${str}`);

    return str;
  }

  private static getAvcCodecString(data: Uint8Array): string | null {
    if (data.length < 4) return "avc1.420028";

    // AVCDecoderConfigurationRecord
    // version = data[0]
    const profile = data[1];
    const profileCompat = data[2];
    const level = data[3];

    const toHex = (n: number) => n.toString(16).padStart(2, "0");

    return `avc1.${toHex(profile)}${toHex(profileCompat)}${toHex(level)}`;
  }

  private static getAv1CodecString(data: Uint8Array): string | null {
    if (data.length < 4) return null;

    const reader = new BitReader(data);
    // marker (1) + version (7)
    reader.skipBits(8);

    const seqProfile = reader.readBits(3);
    const seqLevelIdx0 = reader.readBits(5);
    const seqTier0 = reader.readBits(1);
    const seqBitDepthHigh = reader.readBits(1);
    const seqBitDepthLow = reader.readBits(1);

    const highBitDepth = seqBitDepthHigh;
    const twelveBit = seqBitDepthLow;
    const bitDepth = highBitDepth * 2 + 8 + twelveBit * 2;

    const tierStr = seqTier0 ? "H" : "M";
    const levelStr = seqLevelIdx0.toString().padStart(2, "0");

    return `av01.${seqProfile}.${levelStr}${tierStr}.${bitDepth.toString().padStart(2, "0")}`;
  }

  /*
   * VP8 codec string
   */
  private static getVp8CodecString(_data: Uint8Array): string | null {
    // VP8 is simple
    return "vp8";
  }

  private static getVp9CodecString(data: Uint8Array): string | null {
    if (data.length < 12) {
      Logger.warn(TAG, "VP9 extradata too small");
      return null;
    }

    const reader = new BitReader(data);

    // vpcC is a FullBox. Extradata typically starts after the Box Header (Size, Type).
    // So it starts with Version (1 byte) and Flags (3 bytes).
    reader.skipBits(8); // version
    reader.skipBits(24); // flags

    const profile = reader.readBits(8);
    const level = reader.readBits(8);
    const bitDepth = reader.readBits(4);
    const chromaSubsampling = reader.readBits(3);
    const videoFullRangeFlag = reader.readBits(1);
    const colorPrimaries = reader.readBits(8);
    const transferCharacteristics = reader.readBits(8);
    const matrixCoefficients = reader.readBits(8);

    // Format: vp09.pp.ll.dd.cc.cp.tc.mc.ff
    const toTwoDigit = (n: number) => n.toString().padStart(2, "0");

    return `vp09.${toTwoDigit(profile)}.${toTwoDigit(level)}.${toTwoDigit(bitDepth)}.${toTwoDigit(chromaSubsampling)}.${toTwoDigit(colorPrimaries)}.${toTwoDigit(transferCharacteristics)}.${toTwoDigit(matrixCoefficients)}.${toTwoDigit(videoFullRangeFlag)}`;
  }

  /**
   * Parse VVC (H.266) vvcC configuration record.
   * Layout: configVersion(8) | flags(16) | ptl_present(1) ...
   * If ptl_present: ols_idx(9) | num_sublayers(3) | constant_frame_rate(2) | chroma(2)
   *   | bit_depth_minus8(3) | reserved(5) | ... native_ptl: reserved(2) |
   *   num_bytes_constraint_info(6) | general_profile_idc(7) | general_tier_flag(1) |
   *   general_level_idc(8)
   */
  private static getVvcCodecString(data: Uint8Array): string | null {
    if (data.length < 10) {
      Logger.warn(TAG, `VVC extradata too small: ${data.length}`);
      return null;
    }

    const reader = new BitReader(data);

    reader.skipBits(8); // configurationVersion
    reader.skipBits(16); // lengthSizeMinusOne + flags
    const ptlPresent = reader.readBits(1);
    reader.skipBits(7); // reserved

    if (!ptlPresent) {
      return "vvc1.1.L51"; // fallback
    }

    reader.skipBits(9); // ols_idx
    reader.skipBits(3); // num_sublayers
    reader.skipBits(2); // constant_frame_rate
    reader.skipBits(2); // chroma_format_idc
    reader.skipBits(3); // bit_depth_minus8
    reader.skipBits(5); // reserved

    // native_ptl
    reader.skipBits(2); // reserved
    reader.skipBits(6); // num_bytes_constraint_info
    const profileIdc = reader.readBits(7);
    const tierFlag = reader.readBits(1);
    const levelIdc = reader.readBits(8);

    const tierStr = tierFlag ? "H" : "L";
    return `vvc1.${profileIdc}.${tierStr}${levelIdc}`;
  }

  /**
   * Map ITU-T color primaries enum to string
   */
  private static getColorPrimariesName(primaries: number): string {
    const map: Record<number, string> = {
      1: "bt709",
      5: "bt470m",
      6: "bt470bg",
      7: "smpte170m",
      8: "smpte240m",
      9: "film",
      10: "bt2020",
      11: "smpte428",
      12: "smpte431",
      22: "p3",
    };
    return map[primaries] || `unknown(${primaries})`;
  }

  /**
   * Map ITU-T transfer characteristics enum to string
   */
  private static getTransferCharacteristicsName(transfer: number): string {
    const map: Record<number, string> = {
      1: "bt709",
      4: "gamma22",
      5: "gamma28",
      6: "smpte170m",
      7: "smpte240m",
      8: "linear",
      10: "log100",
      11: "log316",
      13: "iec61966-2-4",
      14: "bt1361",
      15: "iec61966-2-1",
      16: "bt2020-10",
      17: "bt2020-12",
      18: "pq", // PQ (HDR10)
      19: "smpte428",
      20: "hlg", // HLG
    };
    return map[transfer] || `unknown(${transfer})`;
  }

  /**
   * Extract color space information from HEVC extradata (hvcC)
   * This is a simplified parser - full SPS VUI parsing is complex
   */
  private static getHevcColorSpaceInfo(
    data: Uint8Array,
    width?: number,
    height?: number,
  ): ColorSpaceInfo | null {
    // Detect Annex B start codes (00 00 01 or 00 00 00 01)
    const isAnnexB =
      (data.length > 3 && data[0] === 0 && data[1] === 0 && data[2] === 1) ||
      (data.length > 4 &&
        data[0] === 0 &&
        data[1] === 0 &&
        data[2] === 0 &&
        data[3] === 1);

    if (width && height && width >= 3840 && height >= 2160) {
      if (isAnnexB) {
        // Annex B (NAL units) cannot be parsed by our simple BitReader which expects hvcC
        // Trust the resolution for 4K content
        Logger.info(
          TAG,
          `4K HEVC (Annex B) detected, assuming HDR with BT.2020/PQ`,
        );
        return {
          colorPrimaries: "bt2020",
          colorTransfer: "smpte2084",
          colorSpace: "bt2020-ncl",
        };
      }
    }

    if (data.length < 23) {
      // Too small to parse, use heuristic for 4K
      if (width && height && width >= 3840 && height >= 2160) {
        Logger.info(TAG, `4K HEVC detected, assuming HDR with BT.2020/PQ`);
        return {
          colorPrimaries: "bt2020",
          colorTransfer: "smpte2084",
          colorSpace: "bt2020-ncl",
        };
      }
      return null;
    }

    // Heuristic: For 4K UHD HEVC content, assume HDR10 (most common)
    // Full parsing of SPS VUI parameters would require parsing NAL units
    // which is complex. For now, use heuristic based on resolution and profile.
    if (width && height && width >= 3840 && height >= 2160) {
      // Check profile from extradata
      const reader = new BitReader(data);
      reader.skipBits(8); // configurationVersion
      reader.skipBits(2); // general_profile_space
      reader.skipBits(1); // general_tier_flag
      const profileIdc = reader.readBits(5);

      // HEVC Main10 (profile 2) and Rext (profile 4) are commonly used for HDR
      // High tier with high level also suggests HDR
      if (profileIdc === 2 || profileIdc === 4) {
        Logger.info(
          TAG,
          `HEVC Main10/Rext profile detected for 4K, assuming HDR10 (BT.2020/PQ)`,
        );
        return {
          colorPrimaries: "bt2020",
          colorTransfer: "smpte2084", // PQ (HDR10/Dolby Vision)
          colorSpace: "bt2020-ncl",
        };
      }
    }

    // TODO: Full VUI parsing would require:
    // 1. Parsing NAL unit arrays
    // 2. Finding SPS NAL unit
    // 3. Parsing SPS to find VUI parameters
    // 4. Extracting color_primaries, transfer_characteristics, matrix_coeffs
    // This is complex and would require implementing full HEVC SPS parser

    return null;
  }

  /**
   * Extract color space information from VP9 extradata (vpcC)
   */
  private static getVp9ColorSpaceInfo(data: Uint8Array): ColorSpaceInfo | null {
    if (data.length < 12) return null;

    const reader = new BitReader(data);
    reader.skipBits(8); // version
    reader.skipBits(24); // flags

    reader.skipBits(8); // profile
    reader.skipBits(8); // level
    reader.skipBits(4); // bitDepth
    reader.skipBits(3); // chromaSubsampling
    reader.skipBits(1); // videoFullRangeFlag

    const colorPrimaries = reader.readBits(8);
    const transferCharacteristics = reader.readBits(8);
    const matrixCoefficients = reader.readBits(8);

    return {
      colorPrimaries: this.getColorPrimariesName(colorPrimaries),
      colorTransfer: this.getTransferCharacteristicsName(
        transferCharacteristics,
      ),
      colorSpace: matrixCoefficients === 10 ? "bt2020-ncl" : "bt709",
    };
  }
}
