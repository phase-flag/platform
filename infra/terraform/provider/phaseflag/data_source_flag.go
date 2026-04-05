package phaseflag

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-sdk/v2/diag"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/validation"
)

// dataSourceFlag looks up a single feature flag by its key.
func dataSourceFlag() *schema.Resource {
	return &schema.Resource{
		Description: "Fetches a single Phase Flag feature flag by its key.",
		ReadContext: dataSourceFlagRead,
		Schema: map[string]*schema.Schema{
			"key": {
				Type:         schema.TypeString,
				Required:     true,
				Description:  "The unique key of the flag to look up.",
				ValidateFunc: validation.StringIsNotEmpty,
			},
			// Computed attributes populated from the API response.
			"name": {
				Type:        schema.TypeString,
				Computed:    true,
				Description: "Human-readable name of the flag.",
			},
			"description": {
				Type:        schema.TypeString,
				Computed:    true,
				Description: "Description of the flag.",
			},
			"flag_type": {
				Type:        schema.TypeString,
				Computed:    true,
				Description: "Value type of the flag: boolean, string, number, or json.",
			},
			"enabled": {
				Type:        schema.TypeBool,
				Computed:    true,
				Description: "Whether the flag is currently enabled.",
			},
			"tags": {
				Type:        schema.TypeList,
				Computed:    true,
				Description: "Tags attached to the flag.",
				Elem:        &schema.Schema{Type: schema.TypeString},
			},
			"project_id": {
				Type:        schema.TypeString,
				Computed:    true,
				Description: "ID of the project that owns this flag.",
			},
		},
	}
}

func dataSourceFlagRead(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	key := d.Get("key").(string)
	flag, err := c.GetFlag(ctx, key)
	if err != nil {
		return diag.FromErr(err)
	}
	if flag == nil {
		return diag.FromErr(fmt.Errorf("flag with key %q not found", key))
	}

	d.SetId(flag.Key)
	d.Set("name", flag.Name)
	d.Set("description", flag.Description)
	d.Set("flag_type", flag.FlagType)
	d.Set("enabled", flag.Enabled)
	d.Set("tags", flag.Tags)
	d.Set("project_id", flag.ProjectID)

	return nil
}
