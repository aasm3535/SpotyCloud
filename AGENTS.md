# SpotyCloud Development Guide

## Release Workflow

### Creating a New Release

When creating a new release, follow these steps to ensure proper versioning and auto-updater functionality:

#### 1. Update Version Numbers

Update version in ALL these files:
- `package.json` - `"version": "X.Y.Z"`
- `src-tauri/Cargo.toml` - `version = "X.Y.Z"`
- `src-tauri/tauri.conf.json` - `"version": "X.Y.Z"`

#### 2. Commit Changes

```bash
git add -A
git commit -m "release: vX.Y.Z - Description"
```

#### 3. Create and Push Tag

**IMPORTANT**: Do NOT create the tag before pushing the commit!

```bash
# Push commit first
git push origin master

# Then create and push tag
git tag -a vX.Y.Z -m "Release vX.Y.Z - Description"
git push origin vX.Y.Z
```

#### 4. GitHub Actions Will Build Automatically

The workflow (`.github/workflows/build.yml`) will:
1. Check if tag exists (if yes, skip build to avoid conflicts)
2. Build for Windows, macOS Intel, macOS Apple Silicon
3. Create release with all artifacts
4. Generate and merge `latest.json` for auto-updater

#### 5. Verify Release

Check that the release contains:
- [ ] Windows installer (.msi/.exe)
- [ ] macOS Apple Silicon (.dmg)
- [ ] macOS Intel (.dmg)
- [ ] `latest.json` file (for auto-updater)

### Troubleshooting Failed Releases

**Problem**: Build skipped (tag already exists)
**Solution**: Delete and recreate tag:
```bash
git tag -d vX.Y.Z
git push origin --delete vX.Y.Z
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

**Problem**: Empty `latest.json`
**Solution**: The `merge-updater` job in workflow merges updater JSON from all platforms. If it fails, manually create `latest.json`:
```json
{
  "version": "vX.Y.Z",
  "notes": "Release notes",
  "pub_date": "2024-01-01T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "signature_content",
      "url": "https://github.com/.../spotycloud_x64.msi.zip"
    },
    "darwin-aarch64": {
      "signature": "signature_content",
      "url": "https://github.com/.../spotycloud_aarch64.dmg"
    },
    "darwin-x86_64": {
      "signature": "signature_content",
      "url": "https://github.com/.../spotycloud_x64.dmg"
    }
  }
}
```

## Common Bugs and Solutions

### Storage Not Persisting
**Cause**: `saveData()` returns a Promise, must be awaited
**Fix**: Make all save functions async:
```typescript
async function save() {
  await saveData(KEY, data);
}
```

### Discord RPC Not Working
**Cause**: Circular dependency or eager import failing
**Fix**: Use dynamic import:
```typescript
const { getSettings } = await import('./settings.svelte');
```

### Settings Type Errors
If TypeScript complains about missing properties in settings interface:
1. Add property to `AppSettings` interface
2. Add to `defaults` object
3. Add getter in `getSettings()`
4. Add setter function
5. Export setter from module

## Code Style Guidelines

### Svelte 5 Runes
- Use `$state()` for reactive variables
- Use `$derived()` for computed values
- Use `$effect()` for side effects

### Async/Await Pattern
When calling async functions from event handlers:
```svelte
<button onclick={async () => {
  await toggleLike(track);
}}>
```

### Store Patterns
- Export getter function: `getStore()`
- Export async setters: `async function setValue()`
- Always await save operations

## Testing Checklist Before Release

- [ ] Liked tracks save after import
- [ ] Settings persist after restart
- [ ] Discord RPC shows current track
- [ ] Lyrics sync properly
- [ ] Sleep timer works
- [ ] Auto-update check works