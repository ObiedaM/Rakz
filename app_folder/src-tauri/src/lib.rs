use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

fn crash_log_dir() -> PathBuf {
  #[cfg(target_os = "windows")]
  {
    return std::env::var_os("LOCALAPPDATA")
      .map(PathBuf::from)
      .unwrap_or_else(std::env::temp_dir)
      .join("com.rakz.app");
  }
  #[cfg(target_os = "macos")]
  {
    return std::env::var_os("HOME")
      .map(|h| PathBuf::from(h).join("Library/Logs/com.rakz.app"))
      .unwrap_or_else(|| std::env::temp_dir().join("com.rakz.app"));
  }
  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
  {
    return std::env::var_os("XDG_STATE_HOME")
      .map(PathBuf::from)
      .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/state")))
      .unwrap_or_else(std::env::temp_dir)
      .join("com.rakz.app");
  }
}

fn install_panic_logger() {
  let prev = std::panic::take_hook();
  std::panic::set_hook(Box::new(move |info| {
    let log_dir = crash_log_dir();
    if std::fs::create_dir_all(&log_dir).is_ok() {
      if let Ok(mut f) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("crash.log"))
      {
        let _ = writeln!(f, "RAKZ panic: {info}");
      }
    }
    prev(info);
  }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  install_panic_logger();
  let builder = tauri::Builder::default()
    // Two instances writing the same vault corrupt it — a second launch just
    // focuses the window that already owns the files. Must be the first plugin.
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.set_focus();
      }
    }))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    });
  // All 9 IO commands + the opener plugin come from the io_folder crate
  // (opener registers AFTER single-instance — the load-bearing order).
  rakz_io::register(builder)
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
