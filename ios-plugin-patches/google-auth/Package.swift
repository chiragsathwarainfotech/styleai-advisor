// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CodetrixStudioCapacitorGoogleAuth",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CodetrixStudioCapacitorGoogleAuth",
            targets: ["CodetrixStudioCapacitorGoogleAuthPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", "7.0.0"..<"9.0.0"),
        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "CodetrixStudioCapacitorGoogleAuthPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist"],
            sources: ["Plugin.swift"])
    ]
)
