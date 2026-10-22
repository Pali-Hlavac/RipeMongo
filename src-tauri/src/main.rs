// Binary entry point: hides the console window on Windows release builds and delegates to the library.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ripemongo_lib::run();
}
