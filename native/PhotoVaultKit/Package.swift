// swift-tools-version: 6.0
import PackageDescription

// docs/CONTEXT.md §4.1: PhotoVaultKit is "testable without the app" — it targets
// macOS as well as iOS specifically so `swift build`/`swift test` work with just the
// Xcode Command Line Tools (no full Xcode), for the platform-agnostic pieces (path
// templating, date resolution, the Filter→SQL compiler, the GRDB schema). PhotoKit/
// Vision/Core ML-backed code lives behind protocols so it still compiles on macOS,
// even though it can only be exercised for real on iOS. See docs/DECISIONS.md 0002.
//
// Tests use Swift Testing (`import Testing`), not XCTest: XCTest.framework only
// ships with full Xcode, while Swift Testing is bundled with the toolchain itself
// (available automatically for test targets from tools-version 6.0) and runs fine
// under just the Command Line Tools.
let package = Package(
    name: "PhotoVaultKit",
    platforms: [
        .iOS(.v17),
        .macOS(.v13),
    ],
    products: [
        .library(name: "PhotoVaultKit", targets: ["PhotoVaultKit"])
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "7.11.1")
    ],
    targets: [
        .target(
            name: "PhotoVaultKit",
            dependencies: [
                .product(name: "GRDB", package: "GRDB.swift")
            ]
        ),
        .testTarget(
            name: "PhotoVaultKitTests",
            dependencies: ["PhotoVaultKit"],
            // Under bare Command Line Tools (no full Xcode), SwiftPM's implicit
            // Testing dependency doesn't auto-discover its own macro plugin —
            // point at it explicitly. Harmless (and unnecessary) once Xcode is
            // installed. See docs/DECISIONS.md 0002.
            swiftSettings: [
                .unsafeFlags(["-plugin-path", "/Library/Developer/CommandLineTools/usr/lib/swift/host/plugins/testing"])
            ]
        ),
    ]
)
