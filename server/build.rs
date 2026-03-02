/// Build script — verifies that `dist/` exists before rust-embed tries to
/// embed it.  Gives a human-readable error instead of the terse
/// "directory not found" message from the macro expansion.
fn main() {
    let manifest = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let dist = std::path::Path::new(&manifest).join("../dist");

    if !dist.is_dir() {
        panic!(
            "\n\n\
            ┌─────────────────────────────────────────────────────────────┐\n\
            │  BUILD ERROR: frontend dist/ directory not found            │\n\
            │                                                             │\n\
            │  The server embeds the compiled frontend at build time.     │\n\
            │  Build the frontend first:                                  │\n\
            │                                                             │\n\
            │    npm run build                                            │\n\
            │                                                             │\n\
            │  Then rebuild the server:                                   │\n\
            │    cargo build --release --manifest-path server/Cargo.toml  │\n\
            │                                                             │\n\
            │  Or build everything at once:                               │\n\
            │    npm run build:all                                        │\n\
            └─────────────────────────────────────────────────────────────┘\n"
        );
    }

    // Re-run this script whenever frontend assets change so the server
    // binary stays in sync with the latest frontend build.
    println!("cargo:rerun-if-changed=../dist");
}
