//! Integration test harness verifying crate baseline and dependency linkage.

use texturelab::app::TextureLabApp;
use texturelab::version;

#[test]
fn test_crate_version_and_metadata() {
    assert_eq!(version(), "1.0.0");
}

#[test]
fn test_app_instantiation() {
    let app = TextureLabApp::default();
    assert_eq!(app.version(), "1.0.0");
    assert!(!app.title().is_empty());
}

#[test]
fn test_core_dependencies_linkage() {
    // Verify Rayon
    let numbers: Vec<u32> = (0..100).collect();
    use rayon::prelude::*;
    let sum: u32 = numbers.par_iter().sum();
    assert_eq!(sum, 4950);

    // Verify Serde JSON
    #[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug)]
    struct TestPayload {
        name: String,
        count: usize,
    }
    let payload = TestPayload {
        name: "test_node".to_string(),
        count: 42,
    };
    let json = serde_json::to_string(&payload).expect("Serialization failed");
    let deserialized: TestPayload = serde_json::from_str(&json).expect("Deserialization failed");
    assert_eq!(payload, deserialized);

    // Verify Image crate
    let img = image::RgbaImage::new(4, 4);
    assert_eq!(img.width(), 4);
    assert_eq!(img.height(), 4);
}
