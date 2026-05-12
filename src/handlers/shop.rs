Railway deployment failed — Build Error

The Rust build fails with 48 compilation errors that must be fixed in the source code. SQLx compile-time query macros need either a valid DATABASE_URL at build time or offline mode with a committed .sqlx directory, but neither is available. There are also Rust code errors in src/handlers/shop.rs and src/handlers/underdog.rs that must be resolved before the build can succeed.

Repository: https://github.com/nader295/Sprout-Quest
Branch: main · Commit: 6ce62bf — Update Dockerfile
Deployment ID: a22ee7f6-431c-47bd-8fe2-2de51131e087
Service ID: 0085be2a-7431-4253-ba6f-4d82b63f7bcd
Environment ID: d492a6a6-c34e-4766-9bf6-1cf9b1a82d5a

---

## Problem
Service: Sprout-Quest (REPO, nader295/Sprout-Quest, branch main, commit 6ce62bfcd6e26127e8da30ddcfcdc93e05e37e8c). Builder: Dockerfile. Failure stage: BUILD_IMAGE. The build fails with 48 Rust compilation errors during `cargo build --release`.

Three distinct error classes:
1. `error: relative URL without a base` — 40+ occurrences across all files in src/repo/. SQLx compile-time macros (sqlx::query!, sqlx::query_as!, sqlx::query_scalar!) require either a live DATABASE_URL or offline mode (.sqlx directory + `offline` feature). Neither is present.
2. `error[E0716]: temporary value dropped while borrowed` — src/handlers/shop.rs lines 147, 151, 210, 230. The `t!()` macro is called with `&format!(...)` inline, creating a temporary String that is freed before the borrow ends.
3. `error[E0277]: username::Username doesn't implement std::fmt::Display` — src/handlers/underdog.rs line 234, where `mentor.name` (of type `username::Username`) is used in a format string.

## Diagnosis
The previous deployment (d31c63f3) failed because `COPY .sqlx/ .sqlx/` referenced a directory that does not exist in the repo. This commit removed that line and added `ARG DATABASE_URL` / `ENV DATABASE_URL=$DATABASE_URL` to the Dockerfile builder stage, intending to use a live database during build. However, DATABASE_URL was empty or invalid at build time, so SQLx macros still cannot validate queries. The Cargo.toml sqlx entry (`sqlx = { version = "0.8.3", features = [ "runtime-tokio", "postgres", "chrono", "tls-rustls" ] }`) does not include the `offline` feature, so offline mode is unavailable. The shop.rs and underdog.rs errors are independent Rust code bugs introduced separately.

## Fix

### File 1: Cargo.toml
Current sqlx line:
```
sqlx = { version = "0.8.3", features = [ "runtime-tokio", "postgres", "chrono", "tls-rustls" ] }
```
Replace with:
```
sqlx = { version = "0.8.3", features = [ "runtime-tokio", "postgres", "chrono", "tls-rustls", "offline" ] }
```
This enables offline mode so SQLx macros use the cached .sqlx directory instead of a live database.

After editing Cargo.toml, run `cargo sqlx prepare` locally with a valid DATABASE_URL pointing to your Postgres instance. This generates the .sqlx directory. Commit the entire .sqlx directory to the repo.

### File 2: src/handlers/shop.rs
For each of the four E0716 occurrences, bind the formatted key to a `let` before calling `t!()`. Example for line 147:

Current:
```rust
text.push_str(&format!("\n<b>{}:</b>\n", t!(&format!("commands.shop.categories.{}", cat_key), locale = &lang_code)));
```
Replace with:
```rust
let cat_key_path = format!("commands.shop.categories.{}", cat_key);
text.push_str(&format!("\n<b>{}:</b>\n", t!(&cat_key_path, locale = &lang_code)));
```

For lines 151, 210, 230 (all follow the same pattern with `commands.shop.items.{}`):

Current (line 151):
```rust
let item_name = t!(&format!("commands.shop.items.{}", item.key), locale = &lang_code);
```
Replace with:
```rust
let item_key_path = format!("commands.shop.items.{}", item.key);
let item_name = t!(&item_key_path, locale = &lang_code);
```
Apply the same pattern to lines 210 and 230.

### File 3: src/handlers/underdog.rs
Line 234 uses `mentor.name` (type `username::Username`) in a format string via the `t!()` macro, but `Username` does not implement `Display`.

Current (line 234):
```rust
mentor_name = mentor.name)
```
Replace with (using whichever accessor returns a `&str` or `String` for the username type, commonly `.to_string()` or `.as_str()`):
```rust
mentor_name = mentor.name.to_string())
```
If `Username` has a different string accessor (e.g., `.0` for a newtype), use that instead.
