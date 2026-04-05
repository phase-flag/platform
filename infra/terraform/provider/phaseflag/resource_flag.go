package phaseflag

import (
	"context"

	"github.com/hashicorp/terraform-plugin-sdk/v2/diag"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/validation"
)

func resourceFlag() *schema.Resource {
	return &schema.Resource{
		Description:   "Manages a feature flag in Phase Flag.",
		CreateContext: resourceFlagCreate,
		ReadContext:   resourceFlagRead,
		UpdateContext: resourceFlagUpdate,
		DeleteContext: resourceFlagDelete,
		Importer: &schema.ResourceImporter{
			StateContext: schema.ImportStatePassthroughContext,
		},
		Schema: map[string]*schema.Schema{
			"key": {
				Type:        schema.TypeString,
				Required:    true,
				ForceNew:    true,
				Description: "Unique, URL-safe key for the flag (e.g. `new-checkout-flow`). Changing this forces a new resource.",
				ValidateFunc: validation.StringIsNotEmpty,
			},
			"name": {
				Type:        schema.TypeString,
				Required:    true,
				Description: "Human-readable name for the flag.",
				ValidateFunc: validation.StringIsNotEmpty,
			},
			"description": {
				Type:        schema.TypeString,
				Optional:    true,
				Default:     "",
				Description: "Optional description explaining the flag's purpose.",
			},
			"flag_type": {
				Type:         schema.TypeString,
				Optional:     true,
				Default:      "boolean",
				Description:  "Value type of the flag: `boolean`, `string`, `number`, or `json`.",
				ValidateFunc: validation.StringInSlice([]string{"boolean", "string", "number", "json"}, false),
			},
			"enabled": {
				Type:        schema.TypeBool,
				Optional:    true,
				Default:     false,
				Description: "Whether the flag is enabled (serving its on-variation).",
			},
			"tags": {
				Type:        schema.TypeList,
				Optional:    true,
				Description: "Arbitrary tags for organizing flags.",
				Elem: &schema.Schema{
					Type:         schema.TypeString,
					ValidateFunc: validation.StringIsNotEmpty,
				},
			},
			"project_id": {
				Type:        schema.TypeString,
				Optional:    true,
				Default:     "default",
				Description: "ID of the project that owns this flag.",
			},
		},
	}
}

func resourceFlagCreate(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	flag := FlagPayload{
		Key:         d.Get("key").(string),
		Name:        d.Get("name").(string),
		Description: d.Get("description").(string),
		FlagType:    d.Get("flag_type").(string),
		Enabled:     d.Get("enabled").(bool),
		Tags:        expandStringList(d.Get("tags").([]interface{})),
		ProjectID:   d.Get("project_id").(string),
	}

	created, err := c.CreateFlag(ctx, flag)
	if err != nil {
		return diag.FromErr(err)
	}

	// Use the server-assigned ID when available, otherwise fall back to the key.
	id := created.ID
	if id == "" {
		id = created.Key
	}
	d.SetId(id)

	return resourceFlagRead(ctx, d, meta)
}

func resourceFlagRead(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	// The resource is keyed by the flag's key string.
	key := d.Id()
	flag, err := c.GetFlag(ctx, key)
	if err != nil {
		return diag.FromErr(err)
	}
	if flag == nil {
		// Flag was deleted outside Terraform.
		d.SetId("")
		return nil
	}

	d.Set("key", flag.Key)
	d.Set("name", flag.Name)
	d.Set("description", flag.Description)
	d.Set("flag_type", flag.FlagType)
	d.Set("enabled", flag.Enabled)
	d.Set("tags", flag.Tags)
	if flag.ProjectID != "" {
		d.Set("project_id", flag.ProjectID)
	}

	return nil
}

func resourceFlagUpdate(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	key := d.Id()
	flag := FlagPayload{
		Key:         d.Get("key").(string),
		Name:        d.Get("name").(string),
		Description: d.Get("description").(string),
		FlagType:    d.Get("flag_type").(string),
		Enabled:     d.Get("enabled").(bool),
		Tags:        expandStringList(d.Get("tags").([]interface{})),
		ProjectID:   d.Get("project_id").(string),
	}

	_, err := c.UpdateFlag(ctx, key, flag)
	if err != nil {
		return diag.FromErr(err)
	}

	return resourceFlagRead(ctx, d, meta)
}

func resourceFlagDelete(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	if err := c.DeleteFlag(ctx, d.Id()); err != nil {
		return diag.FromErr(err)
	}

	d.SetId("")
	return nil
}

// expandStringList converts []interface{} (as returned by schema.TypeList) to
// []string.
func expandStringList(raw []interface{}) []string {
	result := make([]string, 0, len(raw))
	for _, v := range raw {
		if s, ok := v.(string); ok {
			result = append(result, s)
		}
	}
	return result
}
