/**
 * library_movi.js - JavaScript library for Emscripten Asyncify
 * 
 * Provides async read/seek callbacks that pause WASM execution
 * while waiting for data from JavaScript.
 */

mergeInto(LibraryManager.library, {

    // Mark functions as async for Asyncify
    // IMPORTANT: Uses BigInt arithmetic to handle 64-bit offsets for files >= 2GB
    js_read_async__async: true,
    js_read_async: function (buffer, offset_low, offset_high, size) {
        // Combine 64-bit offset from two 32-bit values using BigInt arithmetic
        // CRITICAL: Convert signed ints to unsigned 32-bit values before BigInt conversion
        // This prevents negative values when offset_low >= 2^31
        var lowUnsigned = offset_low >>> 0;  // Convert to unsigned 32-bit
        var highUnsigned = offset_high >>> 0; // Convert to unsigned 32-bit
        var offset = BigInt(lowUnsigned) + (BigInt(highUnsigned) * 4294967296n);
        // Convert to Number for compatibility, but maintain BigInt when possible
        var offsetNum = Number(offset);
        if (offset > Number.MAX_SAFE_INTEGER) {
            console.warn('[library_movi] Read offset exceeds MAX_SAFE_INTEGER:', offset);
        }

        return Asyncify.handleAsync(function () {
            return new Promise(function (resolve) {
                // Store pending read info
                Module._pendingRead = {
                    buffer: buffer,
                    size: size,
                    resolve: function (bytesRead) {
                        resolve(bytesRead);
                    }
                };

                // Post message to request data from JavaScript
                // Pass BigInt to maintain precision for large offsets
                if (Module.onReadRequest) {
                    Module.onReadRequest(offset, size);
                } else {
                    console.error('[library_movi] No onReadRequest handler registered');
                    resolve(-1);
                }
            });
        });
    },

    // IMPORTANT: Returns BigInt (int64_t) to handle 64-bit offsets for files >= 2GB
    js_seek_async__async: true,
    js_seek_async: function (offset_low, offset_high, whence) {
        // Combine 64-bit offset from two 32-bit values using BigInt arithmetic
        // CRITICAL: Convert signed ints to unsigned 32-bit values before BigInt conversion
        // This prevents negative values when offset_low >= 2^31
        var lowUnsigned = offset_low >>> 0;  // Convert to unsigned 32-bit
        var highUnsigned = offset_high >>> 0; // Convert to unsigned 32-bit
        var offset = BigInt(lowUnsigned) + (BigInt(highUnsigned) * 4294967296n);

        return Asyncify.handleAsync(function () {
            return new Promise(function (resolve) {
                // Store pending seek info
                Module._pendingSeek = {
                    resolve: function (newPosition) {
                        // Ensure result is always BigInt for 64-bit precision
                        try {
                            if (typeof newPosition === 'number') {
                                newPosition = BigInt(Math.floor(newPosition));
                            } else if (typeof newPosition !== 'bigint') {
                                newPosition = BigInt(newPosition);
                            }
                        } catch (e) {
                            console.error('[library_movi] Failed to convert seek result to BigInt:', e);
                            newPosition = -1n;
                        }
                        resolve(newPosition);
                    }
                };

                // Post message to request seek
                // Pass BigInt to maintain precision for large offsets
                if (Module.onSeekRequest) {
                    Module.onSeekRequest(offset, whence);
                } else {
                    console.error('[library_movi] No onSeekRequest handler registered');
                    resolve(-1n);
                }
            });
        });
    },

    // IMPORTANT: Returns BigInt (int64_t) to handle file sizes >= 2GB
    // Synchronous function to get file size (already known)
    js_get_file_size: function () {
        var size = Module._fileSize || 0;
        // Ensure we return BigInt for large file sizes
        if (typeof size === 'bigint') {
            return size;
        }
        return BigInt(Math.floor(size));
    },

    // Thumbnail packet ready callback
    // Called by C when thumbnail packet is found
    js_thumbnail_packet_ready: function (size, pts) {
        console.log('[library_movi] Thumbnail packet ready:', size, pts);
        if (Module._pendingThumbnail) {
            Module._pendingThumbnail.resolve({ size: size, pts: pts });
            Module._pendingThumbnail = null;
        }
    },

    // =========== FMP4 Streaming Async Callbacks ===========

    // Note: Callbacks moved to direct EM_JS implementation in movi_fmp4_stream.c
    // This provides better type safety and cleaner Asyncify integration
});
