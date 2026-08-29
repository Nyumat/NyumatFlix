# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions of Movi-Player:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x (beta)   | :white_check_mark: |
| < 0.1.0 | :x:                |

**Note:** As Movi-Player is currently in beta, we recommend always using the latest version for security updates and bug fixes.

## Reporting a Vulnerability

We take the security of Movi-Player seriously. If you discover a security vulnerability, please report it responsibly using GitHub's private vulnerability reporting feature.

### How to Report

1. **Use GitHub Security Advisories** (Recommended):
   - Navigate to the [Security tab](https://github.com/mrujjwalg/movi-player/security) of the repository
   - Click "Report a vulnerability"
   - Fill out the vulnerability details form
   - Submit your report privately

2. **What to Include**:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact and severity
   - Suggested fix (if you have one)
   - Your contact information for follow-up

### Response Timeline

- **Initial Response**: Within 48-72 hours of submission
- **Status Update**: Within 7 days with assessment and timeline
- **Fix Timeline**: Depends on severity:
  - **Critical**: 1-7 days
  - **High**: 7-14 days
  - **Medium**: 14-30 days
  - **Low**: 30-90 days

### What to Expect

1. **Acknowledgment**: We'll confirm receipt of your report
2. **Investigation**: We'll investigate and validate the vulnerability
3. **Resolution**: We'll develop and test a fix
4. **Disclosure**: We'll coordinate public disclosure with you
5. **Credit**: You'll be credited in the security advisory (if desired)

## Security Considerations

When using Movi-Player, be aware of these security considerations:

### 1. WebAssembly Security

Movi-Player uses WebAssembly (FFmpeg compiled with Emscripten) for video decoding. WebAssembly runs in a sandboxed environment, but:

- **Memory Safety**: WASM has its own linear memory space, isolated from JavaScript
- **No Direct DOM Access**: WASM cannot directly access browser APIs
- **Validated Execution**: WASM modules are validated before execution

**Best Practices:**
- Only load WASM from trusted sources (movi-player's CDN or your own server)
- Verify integrity of WASM files if self-hosting
- Keep movi-player updated to get WASM security patches

### 2. Cross-Origin Isolation (COEP/COOP Headers)

For maximum performance, Movi-Player uses SharedArrayBuffer, which requires:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

**Security Implications:**
- These headers isolate your page from cross-origin resources
- All cross-origin resources must opt-in with CORS headers
- Your page cannot be embedded in cross-origin iframes

**Recommendations:**
- Only enable COI headers if you control all resources
- Use `crossorigin="anonymous"` on external resources
- Test thoroughly before deploying to production

### 3. Content Security Policy (CSP)

If your site uses CSP, you'll need to allow:

```
script-src: 'wasm-unsafe-eval'  (for WebAssembly)
worker-src: blob:               (for Web Workers)
```

**Example CSP Header:**
```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  worker-src 'self' blob:;
  connect-src 'self' https://your-video-cdn.com;
```

### 4. Untrusted Media Files

Movi-Player can process user-uploaded video files. When handling untrusted content:

**Risks:**
- **Malformed Files**: Crafted files might trigger parser bugs
- **Resource Exhaustion**: Extremely large files can consume memory
- **Metadata Injection**: Files might contain malicious metadata

**Mitigations:**
- **Validate File Types**: Check MIME types and file extensions
- **Limit File Sizes**: Enforce maximum file size limits (e.g., 2GB)
- **Sandboxing**: Process files in isolated contexts when possible
- **Error Handling**: Gracefully handle decode errors
- **Resource Limits**: Set memory and buffer limits

**Example Validation:**
```typescript
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

function validateVideoFile(file: File): boolean {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    console.error('File too large');
    return false;
  }

  // Check MIME type
  const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowedTypes.includes(file.type)) {
    console.error('Invalid file type');
    return false;
  }

  return true;
}
```

### 5. HTTP Sources and CORS

When loading videos from HTTP sources:

**CORS Requirements:**
- Server must send `Access-Control-Allow-Origin` header
- Range requests must be supported for seeking
- Credentials should not be included unless necessary

**Security Best Practices:**
- Use HTTPS for all video sources
- Verify server certificates
- Don't expose credentials in URLs
- Implement server-side access controls

### 6. Dependency Security

Movi-Player depends on:
- **hls.js** - HLS streaming support
- **FFmpeg (WASM)** - Media processing

**We actively monitor:**
- npm security advisories
- Dependabot alerts
- CVE databases

**You should:**
- Keep movi-player updated
- Run `npm audit` regularly
- Monitor for security advisories

## Disclosure Policy

### Coordinated Disclosure

We follow responsible disclosure practices:

1. **Private Report**: Reporter submits vulnerability privately
2. **Acknowledgment**: We acknowledge receipt (48-72 hours)
3. **Investigation**: We validate and develop a fix (timeline depends on severity)
4. **Patch Release**: We release a patched version
5. **Public Disclosure**: We publish a security advisory (coordinated with reporter)
6. **Credit**: Reporter receives credit in the advisory (if desired)

### Embargo Period

- **Critical/High**: 7-14 days after patch release
- **Medium/Low**: 14-30 days after patch release

We may extend the embargo period if:
- The vulnerability is complex to fix
- Multiple coordinated releases are needed
- Disclosure would put users at immediate risk

### Public Disclosure

After the embargo period, we will:

1. Publish a GitHub Security Advisory
2. Update the CHANGELOG
3. Announce in GitHub Discussions
4. Credit the reporter (unless they request anonymity)

## Security Updates

Subscribe to security updates:

- **Watch the repository** on GitHub (Security alerts only)
- **GitHub Security Advisories**: [Security tab](https://github.com/mrujjwalg/movi-player/security/advisories)
- **npm**: `npm audit` will show movi-player vulnerabilities

## Security Best Practices for Users

### Production Deployments

1. **Use Latest Version**: Always use the latest stable release
2. **HTTPS Only**: Serve movi-player and videos over HTTPS
3. **CSP Headers**: Implement Content Security Policy
4. **Subresource Integrity**: Use SRI hashes for CDN resources
5. **Input Validation**: Validate all user-provided video sources
6. **Error Handling**: Handle decode errors gracefully
7. **Resource Limits**: Set memory and buffer size limits

### Example Secure Configuration

```typescript
import { MoviPlayer } from 'movi-player/player';

const player = new MoviPlayer({
  source: {
    type: 'url',
    url: validateAndSanitizeUrl(userProvidedUrl), // Validate input
  },
  canvas: canvas,
  cache: {
    maxSizeMB: 100, // Limit cache size
  },
});

// Handle errors
player.on('error', (error) => {
  console.error('Playback error:', error);
  // Show user-friendly error message
  // Don't expose internal error details
});

// Set timeouts for loading
const loadTimeout = setTimeout(() => {
  player.destroy();
  console.error('Load timeout exceeded');
}, 30000);

player.on('loadEnd', () => {
  clearTimeout(loadTimeout);
});
```

## Security Hall of Fame

We thank the following security researchers for responsibly disclosing vulnerabilities:

<!-- This section will be updated as security reports are received and resolved -->

*No vulnerabilities have been reported yet.*

---

## Contact

For security concerns that don't warrant a private vulnerability report, you can:

- Open a [GitHub Discussion](https://github.com/mrujjwalg/movi-player/discussions)
- Create a public [GitHub Issue](https://github.com/mrujjwalg/movi-player/issues) (for non-sensitive matters)

**Do not** disclose security vulnerabilities in public issues or discussions. Always use GitHub Security Advisories for responsible disclosure.

---

**Thank you for helping keep Movi-Player and its users safe!**
