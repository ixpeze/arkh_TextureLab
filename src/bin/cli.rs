use std::process;
use texturelab::cli;

fn main() {
    let args = std::env::args().collect::<Vec<String>>();
    match cli::run(args) {
        Ok(code) => process::exit(code),
        Err(err) => {
            eprintln!("Error: {}", err);
            process::exit(1);
        }
    }
}
