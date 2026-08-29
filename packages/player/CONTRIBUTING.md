# Contributing to Movi-Player

Thank you for your interest in contributing to Movi-Player! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Building the Project](#building-the-project)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Performance Considerations](#performance-considerations)
- [Getting Help](#getting-help)

## Code of Conduct

This project follows a professional and inclusive code of conduct. We expect all contributors to:

- Be respectful and welcoming
- Focus on constructive feedback
- Accept responsibility and learn from mistakes
- Prioritize the community's best interests

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or higher
- **npm** (comes with Node.js)
- **Docker** (required for WASM builds)
- **Git**

### Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/movi-player.git
   cd movi-player
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/mrujjwalg/movi-player.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Check Docker installation** (required for WASM builds):
   ```bash
   docker --version
   ```

## Development Setup

### Initial Build

For a complete build including WASM and TypeScript:

```bash
npm run build
```

This runs:
1. `npm run build:wasm` - Compiles FFmpeg to WebAssembly (Docker required)
2. `npm run build:ts` - Compiles TypeScript and bundles the project

### Quick Development

For TypeScript-only development (if WASM is already built):

```bash
npm run build:ts
```

### Development Server

Start the Vite development server with hot reload:

```bash
npm run dev
```

The server runs at `http://localhost:5173` with special headers for SharedArrayBuffer support:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## Project Structure

```
movi-player/
├── src/                   # TypeScript source code
│   ├── core/             # Core playback engine (MoviPlayer, PlaybackController)
│   ├── demux/            # Demuxing & container parsing
│   ├── decode/           # Decoding (WebCodecs + FFmpeg fallback)
│   ├── render/           # Rendering (Canvas, Audio, HLS)
│   ├── source/           # Data sources (HTTP, File)
│   ├── wasm/             # WebAssembly bindings
│   ├── cache/            # Caching layer
│   ├── events/           # Event system
│   ├── utils/            # Utilities
│   ├── demuxer.ts        # Demuxer module entry (~45KB)
│   ├── player.ts         # Player module entry (~180KB)
│   ├── element.ts        # Element module entry (~410KB)
│   └── index.ts          # Full bundle export
├── wasm/                 # C/WebAssembly source code
│   ├── movi.c/h         # FFmpeg wrapper & main interface
│   ├── movi_decode.c    # Video/audio decoding
│   ├── movi_thumbnail.c # Thumbnail extraction
│   └── library_movi.js  # JavaScript library interface
├── docker/              # Docker configuration
│   └── Dockerfile       # FFmpeg compilation environment
├── docs/                # VitePress documentation
├── examples/            # Example implementations (submodule)
├── scripts/             # Build scripts
├── dist/                # Build output
└── tests/               # Test files
```

### Module Organization

Movi-Player has a modular architecture with three entry points:

1. **Demuxer** (`demuxer.ts`) - ~45KB - Container parsing and metadata
2. **Player** (`player.ts`) - ~180KB - Playback control
3. **Element** (`element.ts` / `index.ts`) - ~410KB - Full UI component

## Development Workflow

### Branch Strategy

- **`main`** - Stable releases only
- **`develop`** - Active development branch
- **`feature/*`** - New features
- **`fix/*`** - Bug fixes
- **`perf/*`** - Performance improvements

### Creating a Feature Branch

Always branch from `develop`:

```bash
git checkout develop
git pull upstream develop
git checkout -b feature/your-feature-name
```

### Commit Message Conventions

Use clear, descriptive commit messages:

```
<type>: <subject>

<optional body>

<optional footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `perf`: Performance improvement
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Build/tooling changes

**Examples:**
```
feat: add VP9 hardware decoding support

fix: resolve A/V sync drift in 4K HEVC playback

perf: optimize thumbnail generation for MPEG-TS files
```

### TypeScript Requirements

All code must:
- Be written in TypeScript with **strict mode** enabled
- Pass type checking: `npm run typecheck`
- Follow existing code patterns and style
- Include JSDoc comments for public APIs

### Code Style

- Use 2-space indentation
- Use single quotes for strings
- Add semicolons
- Follow existing patterns in the codebase
- Keep functions focused and modular
- Avoid deeply nested callbacks (use async/await)

## Building the Project

### Full Build (WASM + TypeScript)

```bash
npm run build
```

This is required when:
- First setting up the project
- WASM code has changed
- Making a release

### WASM Build Only

Requires Docker:

```bash
npm run build:wasm
```

**Note:** WASM builds can take 10-15 minutes. The compiled WASM files are cached in `dist/wasm/`.

To force a rebuild even if files exist:

```bash
npm run build:wasm:force
```

### TypeScript Build Only

Much faster for development:

```bash
npm run build:ts
```

### Clean Build

Remove all build artifacts:

```bash
npm run clean
npm run build
```

## Testing

### Running Tests

```bash
npm test
```

This runs the Vitest test suite.

### Writing Tests

- Add unit tests for new features
- Place tests in `__tests__` directories or next to source files with `.test.ts` suffix
- Test edge cases and error conditions
- Include performance tests for video-heavy features

### Browser Compatibility Testing

Test your changes in:

- **Chrome 94+** (primary target)
- **Safari 16.4+** (WebCodecs support)
- **Edge 94+** (Chromium-based)

**Testing checklist:**
- Video playback starts correctly
- Seeking works (both keyframe and non-keyframe)
- Audio/video sync is maintained
- Memory usage is acceptable
- No console errors or warnings

### Performance Testing

For changes affecting playback, decoding, or rendering:

1. Test with various video formats (MP4, MKV, WebM)
2. Test with different resolutions (720p, 1080p, 4K)
3. Test with HDR content (HEVC Main10, VP9 Profile 2)
4. Monitor memory usage with DevTools
5. Check frame drop rates during playback
6. Verify seeking performance (<300ms for keyframes)

## Documentation

### Updating Documentation

When adding features or changing APIs:

1. **API Documentation** - Update TypeScript JSDoc comments
2. **Guides** - Add/update guides in `docs/guide/`
3. **Examples** - Add code examples to README or `examples/`
4. **Changelog** - Document breaking changes

### Running Documentation Locally

```bash
npm run docs:dev
```

Visit `http://localhost:5173/movi-player/` to preview.

### Building Documentation

```bash
npm run docs:build
```

## Submitting Changes

### Before Submitting

Ensure your changes:

1. **Build successfully**: `npm run build`
2. **Pass type checking**: `npm run typecheck`
3. **Pass all tests**: `npm test`
4. **Follow code style**: Match existing patterns
5. **Include documentation**: Update docs as needed
6. **Work in target browsers**: Chrome, Safari, Edge

### Creating a Pull Request

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub:
   - Target the `develop` branch (not `main`)
   - Use the PR template
   - Provide clear description of changes
   - Link related issues

3. **Respond to feedback**:
   - Address code review comments
   - Make requested changes
   - Keep the PR updated

### Pull Request Checklist

- [ ] Targets `develop` branch
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] No console errors or warnings
- [ ] Documentation updated
- [ ] Code follows project style
- [ ] Commit messages are clear
- [ ] No merge conflicts

### Code Review Process

1. Maintainers will review your PR
2. Address feedback and make changes
3. Once approved, a maintainer will merge

**CI Checks:**
- TypeScript compilation
- Type checking
- Tests (when implemented)

## Performance Considerations

### Memory Usage

Movi-Player handles large video files (multi-GB) with careful memory management:

- **Typical usage**: 200-400MB
- **Peak (4K HEVC)**: ~1.5GB

**Guidelines:**
- Avoid loading entire files into memory
- Use streaming and buffering correctly
- Implement backpressure for data flow
- Clean up resources (frames, buffers) when done
- Test with large files (>1GB)

### Bundle Size

The library has three entry points with specific size targets:

- **Demuxer**: ~45KB (metadata only)
- **Player**: ~180KB (playback without UI)
- **Element**: ~410KB (full UI)

**Guidelines:**
- Keep imports minimal
- Avoid large dependencies
- Use tree-shaking friendly code
- Check bundle size impact: `npm run build:ts`

### Decoding Performance

- Prefer WebCodecs (hardware) over FFmpeg (software)
- Implement proper A/V sync
- Handle frame drops gracefully
- Test with 4K content

## Getting Help

### Resources

- **Documentation**: [mrujjwalg.github.io/movi-player](https://mrujjwalg.github.io/movi-player/)
- **Live Examples**: [movi-player-examples](https://github.com/MrUjjwalG/movi-player-examples)
- **Issues**: [GitHub Issues](https://github.com/mrujjwalg/movi-player/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mrujjwalg/movi-player/discussions)

### Questions

- **General questions**: Use [GitHub Discussions](https://github.com/mrujjwalg/movi-player/discussions)
- **Bug reports**: Use [GitHub Issues](https://github.com/mrujjwalg/movi-player/issues)
- **Feature requests**: Use [GitHub Issues](https://github.com/mrujjwalg/movi-player/issues)

### Common Issues

**Docker build fails:**
- Ensure Docker is running
- Check Docker has enough memory (4GB+ recommended)
- Try `npm run clean && npm run build:wasm:force`

**TypeScript errors:**
- Run `npm install` to ensure dependencies are up to date
- Check `tsconfig.json` is not modified
- Run `npm run typecheck` for detailed errors

**WASM not loading:**
- Run `npm run build:wasm` to rebuild WASM
- Check `dist/wasm/` directory exists and contains `.wasm` files
- Verify server headers for SharedArrayBuffer support

---

## Thank You!

Your contributions make Movi-Player better for everyone. We appreciate your time and effort!

If you have questions about contributing, please open a discussion or issue on GitHub.
