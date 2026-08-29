/**
 * Time - Time utilities for media synchronization
 */

export const TIME_BASE = 1_000_000; // Microseconds (same as FFmpeg AV_TIME_BASE)

export const Time = {
  /**
   * Convert seconds to microseconds
   */
  secondsToUs(seconds: number): number {
    return Math.floor(seconds * TIME_BASE);
  },

  /**
   * Convert microseconds to seconds
   */
  usToSeconds(us: number): number {
    return us / TIME_BASE;
  },

  /**
   * Convert seconds to milliseconds
   */
  secondsToMs(seconds: number): number {
    return Math.floor(seconds * 1000);
  },

  /**
   * Convert milliseconds to seconds
   */
  msToSeconds(ms: number): number {
    return ms / 1000;
  },

  /**
   * Format seconds as HH:MM:SS.mmm
   */
  formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  },

  /**
   * Parse time string to seconds
   */
  parseTime(time: string): number {
    const parts = time.split(':').reverse();
    let seconds = 0;
    
    if (parts[0]) {
      const [sec, ms] = parts[0].split('.');
      seconds += parseFloat(sec) + (ms ? parseFloat(`0.${ms}`) : 0);
    }
    if (parts[1]) seconds += parseFloat(parts[1]) * 60;
    if (parts[2]) seconds += parseFloat(parts[2]) * 3600;
    
    return seconds;
  },

  /**
   * Get high-resolution timestamp in seconds
   */
  now(): number {
    return performance.now() / 1000;
  },
};
