/**
 * PlaybackController - Orchestrates demuxing, decoding, and rendering
 */

import type { Packet } from '../types';
import { Demuxer } from '../demux';
import { MoviVideoDecoder } from '../decode/VideoDecoder';
import { MoviAudioDecoder } from '../decode/AudioDecoder';
import { CanvasRenderer } from '../render/CanvasRenderer';
import { AudioRenderer } from '../render/AudioRenderer';
import { Clock } from './Clock';
import { TrackManager } from './TrackManager';
import { Logger } from '../utils/Logger';

const TAG = 'PlaybackController';

export interface PlaybackControllerConfig {
  canvas: HTMLCanvasElement;
  demuxer: Demuxer;
  trackManager: TrackManager;
  clock: Clock;
}

export class PlaybackController {
  private demuxer: Demuxer;
  private trackManager: TrackManager;
  private clock: Clock;
  
  private videoDecoder: MoviVideoDecoder | null = null;
  private audioDecoder: MoviAudioDecoder | null = null;
  private canvasRenderer: CanvasRenderer;
  private audioRenderer: AudioRenderer;
  
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  
  constructor(config: PlaybackControllerConfig) {
    this.demuxer = config.demuxer;
    this.trackManager = config.trackManager;
    this.clock = config.clock;
    
    this.canvasRenderer = new CanvasRenderer(config.canvas);
    this.audioRenderer = new AudioRenderer();
    
    Logger.debug(TAG, 'Created');
  }
  
  /**
   * Initialize decoders for active tracks
   */
  async init(): Promise<boolean> {
    const videoTrack = this.trackManager.getActiveVideoTrack();
    const audioTrack = this.trackManager.getActiveAudioTrack();
    
    let success = true;
    
    // Initialize video decoder
    if (videoTrack) {
      this.videoDecoder = new MoviVideoDecoder();
      const extradata = this.demuxer.getExtradata(videoTrack.id);
      const configured = await this.videoDecoder.configure(videoTrack, extradata ?? undefined);
      
      if (configured) {
        this.canvasRenderer.configure(videoTrack.width, videoTrack.height);
        
        // Set up frame callback
        this.videoDecoder.setOnFrame((frame) => {
          this.renderVideoFrame(frame);
        });
        
        Logger.info(TAG, `Video decoder initialized: ${videoTrack.codec}`);
      } else {
        Logger.warn(TAG, 'Failed to initialize video decoder');
        this.videoDecoder = null;
        success = false;
      }
    }
    
    // Initialize audio decoder
    if (audioTrack) {
      this.audioDecoder = new MoviAudioDecoder();
      const extradata = this.demuxer.getExtradata(audioTrack.id);
      const configured = await this.audioDecoder.configure(audioTrack, extradata ?? undefined);
      
      if (configured) {
        this.audioRenderer.configure(audioTrack.sampleRate, audioTrack.channels);
        await this.audioRenderer.init();
        
        // Audio is decoded via the FFmpeg/WASM software path only —
        // see MoviAudioDecoder.configure for why the WebCodecs hardware
        // path is gone. PCM frames come out of the software decoder
        // and feed the AudioRenderer's renderPCM hook directly.
        this.audioDecoder.setOnPCM((frame) => {
          this.audioRenderer.renderPCM(frame);
        });
        
        Logger.info(TAG, `Audio decoder initialized: ${audioTrack.codec}`);
      } else {
        Logger.warn(TAG, 'Failed to initialize audio decoder');
        this.audioDecoder = null;
      }
    }
    
    return success;
  }
  
  /**
   * Render a video frame with timing
   */
  private renderVideoFrame(frame: VideoFrame): void {
    const frameTime = frame.timestamp / 1_000_000; // Convert from microseconds to seconds
    const currentTime = this.clock.getTime();
    
    // Simple A/V sync - render immediately if frame time is close enough
    // In a production implementation, you'd buffer frames and render at the right time
    if (Math.abs(frameTime - currentTime) < 0.5) {
      this.canvasRenderer.render(frame);
    }
    
    frame.close();
  }
  
  /**
   * Start playback loop
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    await this.audioRenderer.play();
    
    // Start the decode/render loop
    this.runLoop();
    
    Logger.info(TAG, 'Started');
  }
  
  /**
   * Main playback loop
   */
  private runLoop = async (): Promise<void> => {
    if (!this.isRunning) return;
    
    this.clock.getTime(); // Get time for sync reference
    
    // Read and decode packets
    try {
      // Read a few packets per frame to keep buffers full
      for (let i = 0; i < 3; i++) {
        const packet = await this.demuxer.readPacket();
        if (!packet) break;
        
        this.processPacket(packet);
      }
    } catch (error) {
      Logger.error(TAG, 'Error reading packet', error);
    }
    
    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(() => this.runLoop());
  };
  
  /**
   * Process a demuxed packet
   */
  private processPacket(packet: Packet): void {
    const videoTrack = this.trackManager.getActiveVideoTrack();
    const audioTrack = this.trackManager.getActiveAudioTrack();
    
    // Route to appropriate decoder
    if (videoTrack && packet.streamIndex === videoTrack.id && this.videoDecoder) {
      this.videoDecoder.decode(packet.data, packet.timestamp, packet.keyframe);
    } else if (audioTrack && packet.streamIndex === audioTrack.id && this.audioDecoder) {
      this.audioDecoder.decode(packet.data, packet.timestamp, packet.keyframe);
    }
  }
  
  /**
   * Stop playback loop
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.audioRenderer.pause();
    
    Logger.info(TAG, 'Stopped');
  }
  
  /**
   * Pause playback
   */
  pause(): void {
    this.stop();
  }
  
  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    await this.start();
  }
  
  /**
   * Seek to a position
   */
  async seek(time: number): Promise<void> {
    // Flush decoders
    if (this.videoDecoder) {
      await this.videoDecoder.flush();
    }
    if (this.audioDecoder) {
      await this.audioDecoder.flush();
    }
    
    // Reset audio timing
    this.audioRenderer.reset();
    
    Logger.debug(TAG, `Seeked to ${time}s`);
  }
  
  /**
   * Set volume
   */
  setVolume(volume: number): void {
    this.audioRenderer.setVolume(volume);
  }
  
  /**
   * Get volume
   */
  getVolume(): number {
    return this.audioRenderer.getVolume();
  }
  
  /**
   * Destroy controller
   */
  async destroy(): Promise<void> {
    this.stop();
    
    if (this.videoDecoder) {
      this.videoDecoder.close();
      this.videoDecoder = null;
    }
    
    if (this.audioDecoder) {
      this.audioDecoder.close();
      this.audioDecoder = null;
    }
    
    this.canvasRenderer.destroy();
    await this.audioRenderer.destroy();
    
    Logger.debug(TAG, 'Destroyed');
  }
}
