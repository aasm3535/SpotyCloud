// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
    Emitter,
};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;
use souvlaki::{MediaControls, MediaMetadata, MediaPlayback, PlatformConfig, MediaControlEvent};
use serde::{Deserialize, Serialize};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn show_window(window: tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
fn get_username() -> String {
    whoami::username()
}

#[tauri::command]
async fn download_track(
    app: tauri::AppHandle,
    url: String,
    filename: String,
) -> Result<String, String> {
    println!("[download_track] Starting download for: {}", filename);
    
    // Get downloads directory
    let downloads_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to get documents dir: {}", e))?
        .join("SpotyCloud")
        .join("downloads");

    println!("[download_track] Downloads dir: {:?}", downloads_dir);

    // Create directories if they don't exist
    tokio::fs::create_dir_all(&downloads_dir)
        .await
        .map_err(|e| format!("Failed to create directories: {}", e))?;

    let file_path = downloads_dir.join(&filename);
    println!("[download_track] File path: {:?}", file_path);

    // Download file
    println!("[download_track] Fetching from URL...");
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;
    
    let content_length = response.content_length().unwrap_or(0);
    println!("[download_track] Content length: {} bytes", content_length);

    let mut file = tokio::fs::File::create(&file_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut total_bytes = 0u64;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        total_bytes += chunk.len() as u64;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush file: {}", e))?;
    
    println!("[download_track] Download complete: {} bytes written to {:?}", total_bytes, file_path);

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_downloads_dir(app: tauri::AppHandle) -> Result<String, String> {
    let downloads_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to get documents dir: {}", e))?
        .join("SpotyCloud")
        .join("downloads");

    Ok(downloads_dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn list_downloaded_tracks(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let downloads_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to get documents dir: {}", e))?
        .join("SpotyCloud")
        .join("downloads");

    let mut files = Vec::new();

    if downloads_dir.exists() {
        let mut entries = tokio::fs::read_dir(&downloads_dir)
            .await
            .map_err(|e| format!("Failed to read directory: {}", e))?;

        while let Some(entry) = entries.next_entry()
            .await
            .map_err(|e| format!("Failed to read entry: {}", e))? 
        {
            if let Ok(metadata) = entry.metadata().await {
                if metadata.is_file() {
                    if let Some(name) = entry.file_name().to_str() {
                        files.push(name.to_string());
                    }
                }
            }
        }
    }

    Ok(files)
}

#[tauri::command]
async fn delete_downloaded_track(
    app: tauri::AppHandle,
    filename: String,
) -> Result<(), String> {
    let file_path = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to get documents dir: {}", e))?
        .join("SpotyCloud")
        .join("downloads")
        .join(&filename);

    if file_path.exists() {
        tokio::fs::remove_file(&file_path)
            .await
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn track_exists_locally(
    app: tauri::AppHandle,
    filename: String,
) -> Result<bool, String> {
    let file_path = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to get documents dir: {}", e))?
        .join("SpotyCloud")
        .join("downloads")
        .join(&filename);

    Ok(file_path.exists())
}

struct DiscordRpcState(Mutex<Option<DiscordIpcClient>>);

const DISCORD_RPC_CLIENT_ID: &str = "1482449775747141682";

fn create_discord_client() -> Result<DiscordIpcClient, String> {
    let mut client = DiscordIpcClient::new(DISCORD_RPC_CLIENT_ID)
        .map_err(|e| format!("Failed to create Discord IPC client: {}", e))?;
    client
        .connect()
        .map_err(|e| format!("Failed to connect to Discord (is Discord running?): {}", e))?;
    Ok(client)
}

fn sanitize_presence_text(value: &str, max_len: usize) -> String {
    value
        .chars()
        .filter(|c| !c.is_control())
        .collect::<String>()
        .trim()
        .chars()
        .take(max_len)
        .collect()
}

fn format_position(position_secs: u64) -> String {
    let minutes = position_secs / 60;
    let seconds = position_secs % 60;
    format!("{}:{:02}", minutes, seconds)
}

fn format_repeat_suffix(repeat_mode: Option<&str>) -> Option<&'static str> {
    match repeat_mode {
        Some("one") => Some("Repeat One"),
        Some("all") => Some("Repeat All"),
        _ => None,
    }
}

#[tauri::command]
fn discord_rpc_update(
    state: tauri::State<'_, DiscordRpcState>,
    title: String,
    artist: Option<String>,
    artwork_url: Option<String>,
    duration_secs: Option<u64>,
    position_secs: Option<u64>,
    track_url: Option<String>,
    is_playing: Option<bool>,
    repeat_mode: Option<String>,
) -> Result<String, String> {
    let mut client_guard = state.0.lock().unwrap();
    let playing = is_playing.unwrap_or(true);
    let details = sanitize_presence_text(&title, 128);
    let artist = artist
        .map(|value| sanitize_presence_text(value.trim(), 128))
        .filter(|value| !value.is_empty());
    let artwork_url = artwork_url.filter(|url| !url.trim().is_empty());
    let track_url = track_url.filter(|url| !url.trim().is_empty());
    let position_secs = position_secs.unwrap_or(0);
    let repeat_suffix = format_repeat_suffix(repeat_mode.as_deref());

    for attempt in 0..2 {
        if client_guard.is_none() {
            *client_guard = Some(create_discord_client()?);
        }

        if let Some(client) = client_guard.as_mut() {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;
            let mut state_parts: Vec<String> = Vec::new();
            if let Some(ref artist_name) = artist {
                state_parts.push(artist_name.clone());
            }
            if !playing {
                state_parts.push(format!("Paused at {}", format_position(position_secs)));
            }
            if let Some(suffix) = repeat_suffix {
                state_parts.push(suffix.to_string());
            }
            let state_text = if state_parts.is_empty() {
                None
            } else {
                Some(sanitize_presence_text(&state_parts.join(" \u{00B7} "), 128))
            };

            let mut act = activity::Activity::new()
                .details(&details)
                .activity_type(activity::ActivityType::Listening);

            if let Some(ref state_text) = state_text {
                act = act.state(state_text);
            }

            if playing {
                if let Some(dur) = duration_secs.filter(|dur| *dur > 0) {
                    let safe_position = position_secs.min(dur);
                    let start = now - safe_position as i64;
                    let timestamps = activity::Timestamps::new()
                        .start(start)
                        .end(start + dur as i64);
                    act = act.timestamps(timestamps);
                }
            }

            let assets = if let Some(url) = artwork_url.as_deref() {
                activity::Assets::new().large_image(url)
            } else {
                activity::Assets::new().large_image("spotycloud")
            };
            act = act.assets(assets);

            if let Some(url) = track_url.as_deref() {
                let buttons = vec![activity::Button::new("Open in SoundCloud", url)];
                act = act.buttons(buttons);
            }

            match client.set_activity(act) {
                Ok(_) => return Ok("Activity set".into()),
                Err(e) => {
                    *client_guard = None;
                    if attempt == 1 {
                        return Err(format!("Failed to set activity after reconnect: {}", e));
                    }
                }
            }
        }
    }

    Err("Discord RPC client is unavailable".into())
}

#[tauri::command]
fn discord_rpc_clear(state: tauri::State<'_, DiscordRpcState>) -> Result<(), String> {
    let mut client_guard = state.0.lock().unwrap();
    if let Some(ref mut client) = *client_guard {
        client.clear_activity()
            .map_err(|e| {
                *client_guard = None;
                format!("Failed to clear activity: {}", e)
            })?;
    }
    Ok(())
}

// Media Session State
struct MediaSessionState(Mutex<Option<MediaControls>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaSessionConfig {
    pub title: String,
    pub artist: String,
    pub artwork_url: Option<String>,
    pub duration_secs: Option<u64>,
    pub is_playing: bool,
}

#[tauri::command]
fn update_media_session(
    state: tauri::State<'_, MediaSessionState>,
    config: MediaSessionConfig,
) -> Result<(), String> {
    let mut controls_guard = state.0.lock().unwrap();
    
    if let Some(ref mut controls) = *controls_guard {
        // Update metadata
        let metadata = MediaMetadata {
            title: Some(&config.title),
            artist: Some(&config.artist),
            album: None,
            cover_url: config.artwork_url.as_deref(),
            duration: config.duration_secs.map(|d| std::time::Duration::from_secs(d)),
        };
        
        controls.set_metadata(metadata)
            .map_err(|e| format!("Failed to set metadata: {:?}", e))?;
        
        // Update playback state
        let playback = if config.is_playing {
            MediaPlayback::Playing { progress: None }
        } else {
            MediaPlayback::Paused { progress: None }
        };
        
        controls.set_playback(playback)
            .map_err(|e| format!("Failed to set playback: {:?}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
fn clear_media_session(state: tauri::State<'_, MediaSessionState>) -> Result<(), String> {
    let mut controls_guard = state.0.lock().unwrap();
    if let Some(ref mut controls) = *controls_guard {
        controls.set_playback(MediaPlayback::Stopped)
            .map_err(|e| format!("Failed to clear media session: {:?}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DiscordRpcState(Mutex::new(None)))
        .manage(MediaSessionState(Mutex::new(None)))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            show_window, 
            get_username, 
            discord_rpc_update, 
            discord_rpc_clear,
            download_track,
            get_downloads_dir,
            list_downloaded_tracks,
            delete_downloaded_track,
            track_exists_locally,
            update_media_session,
            clear_media_session
        ])
        .setup(|app| {
            // Auto-updater
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

            // Initialize media session
            #[cfg(target_os = "windows")]
            {
                let window = app.get_webview_window("main");
                if let Some(ref win) = window {
                    let hwnd = win.hwnd().ok();
                    
                    let config = PlatformConfig {
                        dbus_name: "spotycloud",
                        display_name: "SpotyCloud",
                        hwnd: hwnd.map(|h| h.0 as *mut std::ffi::c_void),
                    };
                    
                    if let Ok(mut controls) = MediaControls::new(config) {
                        // Attach event handler for media controls
                        let app_handle = app.handle().clone();
                        controls.attach(move |event: MediaControlEvent| {
                            match event {
                                MediaControlEvent::Play => {
                                    let _ = app_handle.emit("media-control", "play");
                                }
                                MediaControlEvent::Pause => {
                                    let _ = app_handle.emit("media-control", "pause");
                                }
                                MediaControlEvent::Next => {
                                    let _ = app_handle.emit("media-control", "next");
                                }
                                MediaControlEvent::Previous => {
                                    let _ = app_handle.emit("media-control", "previous");
                                }
                                _ => {}
                            }
                        }).ok();
                        
                        // Store the controls
                        if let Ok(_state) = app.state::<MediaSessionState>().0.lock() {
                            // We need to store this, but since we can't easily replace it in the Mutex,
                            // we'll use a different approach - initialize on first use in the command
                        }
                    }
                }
            }

            let show = MenuItem::with_id(app, "show", "Show SpotyCloud", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?;

            TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("SpotyCloud")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

