<div align="center">

<img src="static/icon.svg" width="120" alt="SpotyCloud" />

# SpotyCloud

A desktop SoundCloud player with a Spotify-inspired interface.

[![Build](https://img.shields.io/github/actions/workflow/status/aasm3535/SpotyCloud/build.yml?style=flat-square&logo=github&label=Build)](https://github.com/aasm3535/SpotyCloud/actions)
[![Release](https://img.shields.io/github/v/release/aasm3535/SpotyCloud?style=flat-square&label=Release&color=1db954)](https://github.com/aasm3535/SpotyCloud/releases)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white)](https://svelte.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Rust](https://img.shields.io/badge/Rust-stable-000000?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

<br/>

**SpotyCloud** is a native desktop application that streams music from SoundCloud through a clean, familiar interface. Built with Tauri v2 for performance and a small footprint.

</div>

---

## Installation

### Download

Grab the latest installer from the [Releases](https://github.com/aasm3535/SpotyCloud/releases) page.

| Platform | Format |
|----------|--------|
| Windows | `.msi` / `.exe` |
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |

### Build from source

Requires [Rust](https://rustup.rs) (stable) and [Bun](https://bun.sh) (or Node.js 18+).

```bash
git clone https://github.com/aasm3535/SpotyCloud.git
cd SpotyCloud
bun install
bun run tauri dev      # development
bun run tauri build    # production build
```

---

## Features

### Playback
- Stream any public SoundCloud track (progressive and HLS)
- Full playback controls: play, pause, skip, previous, seek, shuffle, repeat
- Volume control with mute toggle
- Keyboard shortcuts (Space to play/pause, Ctrl+Arrow to skip)
- Media session integration (OS media controls)

### Your Wave
- Personalized auto-play radio based on your liked tracks
- Automatically fetches related tracks when the queue runs out
- Like or dislike tracks during wave mode to refine recommendations
- Disliked tracks are remembered and excluded from future suggestions

### Library
- Like and save tracks locally
- Create and manage custom playlists
- Collapsible sidebar with compact icon mode
- Search with infinite scroll

### Equalizer
- 10-band equalizer (60 Hz to 16 kHz)
- 13 built-in presets: Flat, Bass Boost, Rock, Pop, Electronic, Hip-Hop, Jazz, Classical, Vocal, Loudness, and more
- Per-band adjustment from -12 to +12 dB
- Toggle on/off without losing settings
- Settings persist across sessions

### Downloads
- Download tracks for offline playback
- Automatic offline detection and local file playback
- Manage downloaded tracks (list, delete)

### Discord Rich Presence
- Displays currently playing track with artwork
- Shows elapsed and remaining time
- "Listen on SoundCloud" button linking to the track
- Small icon indicating playback through SpotyCloud

### Auto-Update
- Checks for updates on launch and every 30 minutes
- In-app download with progress bar
- One-click install and restart
- Signed updates via GitHub Releases

### Interface
- Custom title bar with window controls
- Resizable sidebar with drag handle
- Option to keep sidebar always collapsed
- Animated gradient backgrounds on the home page
- Spotify-style scrollbars and track rows
- Onboarding flow for first-time setup
- System tray with show/quit menu

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Tauri v2](https://tauri.app) (Rust backend) |
| Frontend | [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Icons | [Lucide](https://lucide.dev) |
| Streaming | [HLS.js](https://github.com/video-dev/hls.js) |
| Audio Processing | Web Audio API (BiquadFilter) |
| Package Manager | [Bun](https://bun.sh) |
| HTTP | [tauri-plugin-http](https://github.com/nickvdyck/tauri-plugin-http) |
| Discord IPC | [discord-rich-presence](https://crates.io/crates/discord-rich-presence) |

---

## How It Works

SpotyCloud connects to the SoundCloud public API using a `client_id` extracted from the SoundCloud web app. No account login or OAuth is required. The app provides a guided setup process — either through a console script or manual extraction from browser network requests.

All user data (liked tracks, playlists, equalizer settings, preferences) is stored as JSON files in `Documents/SpotyCloud/data/`. This ensures your data persists across app updates. Downloaded tracks are saved to `Documents/SpotyCloud/downloads/`.

---

## Project Structure

```
src/                    # SvelteKit frontend
  lib/
    api/                # SoundCloud API client and types
    components/         # UI components (PlayerBar, Sidebar, TrackRow, etc.)
    stores/             # Svelte 5 reactive stores (player, liked, playlists, EQ, etc.)
    utils/              # Helpers (formatting, color, image)
  routes/               # Pages (home, search, liked, playlist, settings)
src-tauri/              # Tauri / Rust backend
  src/lib.rs            # Commands (download, Discord RPC, system info)
```

---

## CI / CD

Releases are fully automated. Every push to `master` triggers a build if the version in `package.json` has changed. The workflow:

1. Reads the version from `package.json`
2. Checks if a release for that version already exists
3. If not, builds native installers for all platforms and publishes a release

To ship a new version, bump the version in `package.json` and push:

```bash
# in package.json: "version": "0.2.0"
git add package.json
git commit -m "bump version to 0.2.0"
git push
```

Installers for Windows (`.msi`, `.exe`) and macOS (`.dmg` for both Apple Silicon and Intel) will appear on the [Releases](https://github.com/aasm3535/SpotyCloud/releases) page automatically.

---

## License

MIT
