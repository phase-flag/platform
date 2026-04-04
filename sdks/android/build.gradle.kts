plugins {
    kotlin("jvm") version "1.9.22"
    id("maven-publish")
}

group = "dev.phaseflag"
version = "0.1.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}

kotlin {
    jvmToolchain(17)
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            groupId = "dev.phaseflag"
            artifactId = "sdk-android"
            version = project.version.toString()
            from(components["java"])
        }
    }
}
