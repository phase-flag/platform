package cmd

import (
	"fmt"
	"runtime"
)

// VersionCommand prints version information.
func VersionCommand(version string) {
	fmt.Printf("pfctl %s\n", version)
	fmt.Printf("Go:       %s\n", runtime.Version())
	fmt.Printf("OS/Arch:  %s/%s\n", runtime.GOOS, runtime.GOARCH)
}
