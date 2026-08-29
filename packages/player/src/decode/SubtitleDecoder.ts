/**
 * SubtitleDecoder - Decodes subtitle packets using WASM/FFmpeg
 */

import type { SubtitleTrack, SubtitleCue } from '../types';
import { Logger } from '../utils/Logger';
import { WasmBindings } from '../wasm/bindings';

const TAG = 'SubtitleDecoder';

export class SubtitleDecoder {
  private bindings: WasmBindings | null = null;
  private isConfigured: boolean = false;
  private currentTrack: SubtitleTrack | null = null;
  private onCue: ((cue: SubtitleCue) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  
  constructor() {
    Logger.debug(TAG, 'Created');
  }

  setBindings(bindings: WasmBindings, autoConfigure: boolean = true) {
    this.bindings = bindings;
    
    // If we have a track but decoder wasn't configured yet, configure it now
    // Only auto-configure if explicitly requested (prevents duplicate calls)
    if (autoConfigure && this.currentTrack && !this.isConfigured && this.bindings) {
      this.configure(this.currentTrack).catch((error) => {
        Logger.error(TAG, 'Failed to configure decoder after bindings set', error);
      });
    }
  }
  
  /**
   * Configure the decoder for a specific track
   */
  async configure(track: SubtitleTrack, extradata?: Uint8Array): Promise<boolean> {
    Logger.debug(TAG, `configure called: track=${track.id}, codec=${track.codec}, type=${track.subtitleType}`);
    this.currentTrack = track;
    this.isConfigured = false;

    if (!this.bindings) {
      Logger.warn(TAG, 'WASM bindings not set, will be set later');
      // Store track info for later configuration when bindings are set
      return true; // Return true so we can configure later
    }

    // Enable decoder for this subtitle track, passing any available extradata
    Logger.debug(TAG, `Attempting to enable subtitle decoder for track ${track.id}, codec: ${track.codec}, type: ${track.subtitleType}, extradata=${extradata?.length ?? 0} bytes`);
    const result = await this.bindings.enableDecoder(track.id, extradata);
    Logger.debug(TAG, `enableDecoder result: ${result}`);
    if (result !== 0) {
      // Error codes: -1=invalid context/stream, -2=codec not found, -3=alloc failed, -4=params failed, -5=open failed
      const errorMsg = result === -2 
        ? `Subtitle codec '${track.codec}' not found/not compiled in WASM build`
        : `Failed to enable subtitle decoder (error ${result})`;
      Logger.error(TAG, errorMsg);
      Logger.warn(TAG, `Subtitle track ${track.id} (${track.codec}) cannot be decoded - codec may not be available in WASM build`);
      return false;
    }

    this.isConfigured = true;
    Logger.info(TAG, `Subtitle decoder configured for track ${track.id}: ${track.codec}`);
    return true;
  }
  
  /**
   * Decode a subtitle packet
   */
  async decode(data: Uint8Array, timestamp: number, _keyframe: boolean, duration?: number): Promise<void> {
    if (!this.isConfigured || !this.bindings || !this.currentTrack) {
      Logger.debug(TAG, `Skipping decode: configured=${this.isConfigured}, bindings=${!!this.bindings}, track=${!!this.currentTrack}`);
      return;
    }

    Logger.debug(TAG, `Decoding subtitle packet: track=${this.currentTrack.id}, size=${data.length}, timestamp=${timestamp.toFixed(3)}s, duration=${duration?.toFixed(3) ?? 'undefined'}s`);

    try {
      // Decode subtitle packet
      const result = await this.bindings.decodeSubtitle(this.currentTrack.id, data, timestamp, duration);
      // WASI/Emscripten: EAGAIN=6, so AVERROR(EAGAIN)=-6 (not -11 like Linux)
      Logger.debug(TAG, `Subtitle decode result: ${result} (0=success, -6=EAGAIN, other=error)`);
      
      if (result === 0) {
        // Successfully decoded, get subtitle times first (needed for both text and image)
        const times = await this.bindings.getSubtitleTimes();
        
        if (!times) {
          Logger.warn(TAG, 'Missing subtitle times');
          await this.bindings.freeSubtitle();
          return;
        }
        
        // Check if this is an image subtitle (PGS, etc.)
        const imageInfo = await this.bindings.getSubtitleImageInfo();
        
        if (imageInfo) {
          // Image subtitle (PGS, DVD subtitles, etc.)
          Logger.debug(TAG, `Decoded image subtitle: ${imageInfo.width}x${imageInfo.height} at (${imageInfo.x}, ${imageInfo.y}), times=${times.start.toFixed(3)}s-${times.end.toFixed(3)}s`);
          
          // Get image data as RGBA
          const imageData = await this.bindings.getSubtitleImageData();
          
          if (imageData) {
            // Create ImageBitmap from RGBA data
            try {
              const imageBitmap = await createImageBitmap(
                new ImageData(
                  new Uint8ClampedArray(imageData),
                  imageInfo.width,
                  imageInfo.height
                )
              );
              
              const cue: SubtitleCue = {
                start: times.start,
                end: times.end,
                image: imageBitmap,
                position: { x: imageInfo.x, y: imageInfo.y },
              };
              
              Logger.info(TAG, `Created image subtitle cue: ${imageInfo.width}x${imageInfo.height} (${times.start.toFixed(2)}s - ${times.end.toFixed(2)}s)`);
              
              if (this.onCue) {
                Logger.debug(TAG, 'Calling onCue callback with image');
                this.onCue(cue);
              } else {
                Logger.warn(TAG, 'No onCue callback set!');
                imageBitmap.close(); // Clean up if no callback
              }
            } catch (error) {
              Logger.error(TAG, 'Failed to create ImageBitmap from subtitle', error);
            }
          } else {
            Logger.warn(TAG, 'Failed to extract image data from subtitle');
          }
        } else {
          // Text subtitle (SRT, ASS, etc.)
          const text = await this.bindings.getSubtitleText();
          
          Logger.debug(TAG, `Decoded subtitle: text=${text ? `"${text.substring(0, 50)}..."` : 'null'}, times=${times.start.toFixed(3)}s-${times.end.toFixed(3)}s`);
          
          if (text) {
            const cue: SubtitleCue = {
              start: times.start,
              end: times.end,
              text: text,
            };
            
            Logger.info(TAG, `Created subtitle cue: "${text.substring(0, 30)}..." (${times.start.toFixed(2)}s - ${times.end.toFixed(2)}s)`);
            
            if (this.onCue) {
              Logger.debug(TAG, 'Calling onCue callback');
              this.onCue(cue);
            } else {
              Logger.warn(TAG, 'No onCue callback set!');
            }
          } else {
            Logger.warn(TAG, 'No text extracted from subtitle');
          }
        }
        
        // Free subtitle after reading
        await this.bindings.freeSubtitle();
      } else if (result !== -6) { // -6 is AVERROR(EAGAIN) in WASI/Emscripten
        Logger.warn(TAG, `Subtitle decode returned: ${result}`);
      }
    } catch (error) {
      Logger.error(TAG, 'Subtitle decode error', error);
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }
  
  /**
   * Set callback for decoded subtitle cues
   */
  setOnCue(callback: (cue: SubtitleCue) => void): void {
    this.onCue = callback;
  }
  
  /**
   * Set error callback
   */
  setOnError(callback: (error: Error) => void): void {
    this.onError = callback;
  }
  
  /**
   * Close the decoder
   */
  close(): void {
    this.isConfigured = false;
    this.currentTrack = null;
    this.onCue = null;
    this.onError = null;
    Logger.debug(TAG, 'Closed');
  }
}
