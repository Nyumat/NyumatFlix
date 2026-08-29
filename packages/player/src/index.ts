/**
 * Movi - Modular Streaming Video Library
 *
 * A production-grade JavaScript + WebAssembly library for streaming,
 * seeking, and rendering multi-GB video files in the browser.
 *
 * This is the complete bundle. For smaller bundles, import specific modules:
 * - import { Demuxer } from 'movi/demuxer'        (~45KB - demuxing only)
 * - import { MoviPlayer } from 'movi/player'      (~180KB - playback without UI)
 * - import { MoviElement } from 'movi/element'    (~410KB - full web component)
 */

// Export everything from element module (includes player and demuxer)
export * from './element';