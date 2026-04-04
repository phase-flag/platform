// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "PhaseFlag",
    platforms: [
        .macOS(.v12),
        .iOS(.v15),
        .tvOS(.v15),
        .watchOS(.v8),
    ],
    products: [
        .library(
            name: "PhaseFlag",
            targets: ["PhaseFlag"]
        ),
    ],
    targets: [
        .target(
            name: "PhaseFlag",
            dependencies: [],
            path: "Sources/PhaseFlag"
        ),
    ]
)
