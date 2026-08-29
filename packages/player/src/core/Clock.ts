/**
 * Clock - Audio/Video synchronization clock
 * Uses audio as the master clock when available for smooth 60Hz playback
 */

import { Time } from '../utils/Time';
import { Logger } from '../utils/Logger';

const TAG = 'Clock';

// Audio clock provider interface
export interface AudioClockProvider {
  getAudioClock(): number;
  hasHealthyBuffer(): boolean;
  isAudioPlaying(): boolean;
}

export class Clock {
  private baseTime: number = 0;
  private pausedTime: number = 0;
  private isRunning: boolean = false;
  private playbackRate: number = 1.0;
  
  // Audio clock provider for A/V sync
  private audioProvider: AudioClockProvider | null = null;
  private syncedToAudio: boolean = false;
  private lastAudioTime: number = 0; // Cache last known good audio time
  private duration: number = 0; // Media duration for clamping
  
  /**
   * Set audio clock provider for master A/V sync
   * Pass null to disable audio sync and use wall clock only
   */
  setAudioProvider(provider: AudioClockProvider | null): void {
    this.audioProvider = provider;
    if (provider) {
    Logger.debug(TAG, 'Audio provider set');
    } else {
      Logger.debug(TAG, 'Audio provider disabled - using wall clock only');
      this.syncedToAudio = false;
    }
  }
  
  /**
   * Set media duration for clock clamping
   */
  setDuration(duration: number): void {
    this.duration = duration;
    Logger.debug(TAG, `Duration set to ${duration}s`);
  }
  
  /**
   * Start/resume the clock
   */
  start(): void {
    if (this.isRunning) return;
    
    // Adjust baseTime to account for paused duration
    this.baseTime = Time.now() - (this.pausedTime / this.playbackRate);
    this.isRunning = true;
    this.syncedToAudio = false;
    Logger.debug(TAG, `Started at ${this.pausedTime}s`);
  }
  
  /**
   * Pause the clock
   */
  pause(): void {
    if (!this.isRunning) return;
    
    this.pausedTime = this.getTime();
    this.isRunning = false;
    Logger.debug(TAG, `Paused at ${this.pausedTime}s`);
  }
  
  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    if (this.isRunning) {
      this.baseTime = Time.now() - (time / this.playbackRate);
    } else {
      this.pausedTime = time;
    }
    this.syncedToAudio = false;
    Logger.debug(TAG, `Seeked to ${time}s`);
  }
  
  /**
   * Get current playback time using wall clock with loose A/V sync
   * Uses wall clock for smooth timing, with periodic drift correction from audio
   * This ensures smooth video playback while maintaining A/V sync
   */
  getTime(): number {
    if (!this.isRunning) {
      return this.pausedTime;
    }
    
    // Always calculate wall clock time first (for smooth playback)
    let wallClockTime = (Time.now() - this.baseTime) * this.playbackRate;
    
    // Clamp to duration if set
    if (this.duration > 0) {
      wallClockTime = Math.min(wallClockTime, this.duration);
    }
    
    // Check audio for drift correction (but don't block on it)
    if (this.audioProvider) {
      const audioTime = this.audioProvider.getAudioClock();
      if (audioTime >= 0) {
        // Cache the audio time
        this.lastAudioTime = audioTime;
        
        if (this.audioProvider.hasHealthyBuffer()) {
          // First sync - initialize wall clock to match audio
          if (!this.syncedToAudio) {
            this.baseTime = Time.now() - (audioTime / this.playbackRate);
            this.syncedToAudio = true;
            Logger.debug(TAG, `Synced to audio at ${audioTime}s`);
            return audioTime;
          }
          
          // Loose sync: only correct if wall clock has drifted more than 100ms from audio
          // This prevents audio jitter from affecting smooth video playback
          const drift = wallClockTime - audioTime;
          
          if (Math.abs(drift) > 0.1) {
            // Apply gradual correction (50% per check) to avoid jarring jumps
            const correction = drift * 0.5;
            this.baseTime += correction / this.playbackRate;
            // Logger.debug(TAG, `Clock drift correction: ${(drift * 1000).toFixed(1)}ms`);
          }
          
          // Recalculate wall clock time after correction
          wallClockTime = (Time.now() - this.baseTime) * this.playbackRate;
          if (this.duration > 0) {
            wallClockTime = Math.min(wallClockTime, this.duration);
          }
        } else {
          // Audio not healthy - just use wall clock
        }
      } else if (this.lastAudioTime > 0) {
        // Audio returned -1 but we had a previous time - continue with wall clock
        // Don't return cached audio time as it's stale
      }
    }
    
    return wallClockTime;
  }
  
  /**
   * Get time for video frame presentation
   * Returns audio time if available, otherwise wall clock
   */
  getVideoSyncTime(): number {
    if (!this.isRunning) {
      return this.pausedTime;
    }
    
    // For video sync, ALWAYS prefer audio when healthy
    if (this.audioProvider) {
      const audioTime = this.audioProvider.getAudioClock();
      if (audioTime >= 0 && this.audioProvider.hasHealthyBuffer()) {
        return audioTime;
      } else if (audioTime >= 0) {
        // Audio not healthy but has a valid (clamped) time
        return audioTime;
      }
    }
    
    let time = (Time.now() - this.baseTime) * this.playbackRate;
    
    // Clamp to duration if set
    if (this.duration > 0) {
      time = Math.min(time, this.duration);
    }
    
    return time;
  }
  
  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void {
    const currentTime = this.getTime();
    this.playbackRate = rate;
    this.seek(currentTime);
    Logger.debug(TAG, `Playback rate set to ${rate}`);
  }
  
  /**
   * Get playback rate
   */
  getPlaybackRate(): number {
    return this.playbackRate;
  }
  
  /**
   * Check if clock is running
   */
  isPlaying(): boolean {
    return this.isRunning;
  }
  
  /**
   * Check if synchronized to audio
   */
  isSyncedToAudio(): boolean {
    return this.syncedToAudio && this.audioProvider !== null;
  }
  
  /**
   * Reset clock
   */
  reset(): void {
    this.baseTime = 0;
    this.pausedTime = 0;
    this.isRunning = false;
    this.playbackRate = 1.0;
    this.syncedToAudio = false;
    this.lastAudioTime = 0;
    this.duration = 0;
    Logger.debug(TAG, 'Reset');
  }
}
