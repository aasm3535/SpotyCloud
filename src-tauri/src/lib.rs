// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;

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

#[tauri::command]
fn discord_rpc_update(
    state: tauri::State<'_, DiscordRpcState>,
    title: String,
    artist: String,
    artwork_url: Option<String>,
    duration_secs: Option<u64>,
    track_url: Option<String>,
) -> Result<String, String> {
    let mut client_guard = state.0.lock().unwrap();

    // Try to connect if we don't have a client yet
    if client_guard.is_none() {
        let mut client = DiscordIpcClient::new("1482449775747141682")
            .map_err(|e| format!("Failed to create Discord IPC client: {}", e))?;
        client.connect()
            .map_err(|e| format!("Failed to connect to Discord (is Discord running?): {}", e))?;
        *client_guard = Some(client);
    }

    let client = client_guard.as_mut().unwrap();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let details_str = title;
    let state_str = format!("by {}", artist);
    let mut act = activity::Activity::new()
        .details(&details_str)
        .state(&state_str)
        .activity_type(activity::ActivityType::Listening);

    let timestamps;
    if let Some(dur) = duration_secs {
        timestamps = activity::Timestamps::new()
            .start(now)
            .end(now + dur as i64);
        act = act.timestamps(timestamps);
    }

    let assets;
    if let Some(ref url) = artwork_url {
        assets = activity::Assets::new()
            .large_image(url.as_str())
            .large_text("SpotyCloud")
            .small_image("spotycloud")
            .small_text("Listening with SpotyCloud");
    } else {
        assets = activity::Assets::new()
            .large_image("spotycloud")
            .large_text("SpotyCloud");
    }
    act = act.assets(assets);

    let buttons;
    if let Some(ref url) = track_url {
        buttons = vec![activity::Button::new("Listen on SoundCloud", url)];
        act = act.buttons(buttons);
    }

    match client.set_activity(act) {
        Ok(_) => Ok("Activity set".into()),
        Err(e) => {
            // Connection likely dropped, reset so next call reconnects
            *client_guard = None;
            Err(format!("Failed to set activity (will retry next track): {}", e))
        }
    }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DiscordRpcState(Mutex::new(None)))
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
            track_exists_locally
        ])
        .setup(|app| {
            // Auto-updater
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

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
