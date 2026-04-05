package phaseflag

import (
	"context"
	"crypto/sha256"
	"fmt"

	"github.com/hashicorp/terraform-plugin-sdk/v2/diag"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
)

// dataSourceFlags lists all feature flags, with an optional search filter.
func dataSourceFlags() *schema.Resource {
	return &schema.Resource{
		Description: "Returns a list of Phase Flag feature flags, optionally filtered by a search term.",
		ReadContext: dataSourceFlagsRead,
		Schema: map[string]*schema.Schema{
			"search": {
				Type:        schema.TypeString,
				Optional:    true,
				Default:     "",
				Description: "Optional search string to filter flags by name or key.",
			},
			// Computed: the list of matching flags.
			"flags": {
				Type:        schema.TypeList,
				Computed:    true,
				Description: "List of flags matching the search filter.",
				Elem: &schema.Resource{
					Schema: map[string]*schema.Schema{
						"key": {
							Type:        schema.TypeString,
							Computed:    true,
							Description: "Unique key of the flag.",
						},
						"name": {
							Type:        schema.TypeString,
							Computed:    true,
							Description: "Human-readable name.",
						},
						"description": {
							Type:        schema.TypeString,
							Computed:    true,
							Description: "Description of the flag.",
						},
						"flag_type": {
							Type:        schema.TypeString,
							Computed:    true,
							Description: "Value type: boolean, string, number, or json.",
						},
						"enabled": {
							Type:        schema.TypeBool,
							Computed:    true,
							Description: "Whether the flag is enabled.",
						},
						"tags": {
							Type:        schema.TypeList,
							Computed:    true,
							Description: "Tags attached to the flag.",
							Elem:        &schema.Schema{Type: schema.TypeString},
						},
					},
				},
			},
		},
	}
}

func dataSourceFlagsRead(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	search := d.Get("search").(string)
	flags, err := c.ListFlags(ctx, search)
	if err != nil {
		return diag.FromErr(err)
	}

	result := make([]map[string]interface{}, 0, len(flags))
	for _, f := range flags {
		result = append(result, map[string]interface{}{
			"key":         f.Key,
			"name":        f.Name,
			"description": f.Description,
			"flag_type":   f.FlagType,
			"enabled":     f.Enabled,
			"tags":        f.Tags,
		})
	}

	if err := d.Set("flags", result); err != nil {
		return diag.FromErr(err)
	}

	// Derive a stable ID from the search term so Terraform doesn't think the
	// data source changes every plan.
	h := sha256.Sum256([]byte(search))
	d.SetId(fmt.Sprintf("flags-%x", h[:8]))

	return nil
}
