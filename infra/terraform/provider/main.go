package main

import (
	"github.com/hashicorp/terraform-plugin-sdk/v2/plugin"
	"github.com/phaseflag/terraform-provider-phaseflag/phaseflag"
)

func main() {
	plugin.Serve(&plugin.ServeOpts{
		ProviderFunc: phaseflag.Provider,
	})
}
