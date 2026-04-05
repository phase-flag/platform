package phaseflag

import (
	"context"

	"github.com/hashicorp/terraform-plugin-sdk/v2/diag"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
)

// Provider returns the Phase Flag Terraform provider.
func Provider() *schema.Provider {
	return &schema.Provider{
		Schema: map[string]*schema.Schema{
			"api_url": {
				Type:        schema.TypeString,
				Required:    true,
				DefaultFunc: schema.EnvDefaultFunc("PHASEFLAG_API_URL", "http://localhost:8000"),
				Description: "The base URL of the Phase Flag API (e.g. https://api.phaseflag.io). " +
					"Can also be set via the PHASEFLAG_API_URL environment variable.",
			},
			"api_key": {
				Type:        schema.TypeString,
				Required:    true,
				Sensitive:   true,
				DefaultFunc: schema.EnvDefaultFunc("PHASEFLAG_API_KEY", nil),
				Description: "API key used to authenticate requests to the Phase Flag API. " +
					"Can also be set via the PHASEFLAG_API_KEY environment variable.",
			},
		},
		ResourcesMap: map[string]*schema.Resource{
			"phaseflag_flag":    resourceFlag(),
			"phaseflag_project": resourceProject(),
			"phaseflag_segment": resourceSegment(),
		},
		DataSourcesMap: map[string]*schema.Resource{
			"phaseflag_flag":  dataSourceFlag(),
			"phaseflag_flags": dataSourceFlags(),
		},
		ConfigureContextFunc: providerConfigure,
	}
}

// providerConfigure initialises the Phase Flag HTTP client and stores it in the
// provider meta so every resource/data-source can retrieve it.
func providerConfigure(_ context.Context, d *schema.ResourceData) (interface{}, diag.Diagnostics) {
	apiURL := d.Get("api_url").(string)
	apiKey := d.Get("api_key").(string)

	client := newClient(apiURL, apiKey)
	return client, nil
}
