package phaseflag

import (
	"context"

	"github.com/hashicorp/terraform-plugin-sdk/v2/diag"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/validation"
)

func resourceSegment() *schema.Resource {
	return &schema.Resource{
		Description:   "Manages a targeting segment in Phase Flag. Segments define reusable groups of users.",
		CreateContext: resourceSegmentCreate,
		ReadContext:   resourceSegmentRead,
		UpdateContext: resourceSegmentUpdate,
		DeleteContext: resourceSegmentDelete,
		Importer: &schema.ResourceImporter{
			StateContext: schema.ImportStatePassthroughContext,
		},
		Schema: map[string]*schema.Schema{
			"key": {
				Type:         schema.TypeString,
				Required:     true,
				ForceNew:     true,
				Description:  "Unique, URL-safe key for the segment (e.g. `beta-users`). Changing this forces a new resource.",
				ValidateFunc: validation.StringIsNotEmpty,
			},
			"name": {
				Type:         schema.TypeString,
				Required:     true,
				Description:  "Human-readable name for the segment.",
				ValidateFunc: validation.StringIsNotEmpty,
			},
			"description": {
				Type:        schema.TypeString,
				Optional:    true,
				Default:     "",
				Description: "Optional description of the segment.",
			},
			"conditions": {
				Type:         schema.TypeString,
				Optional:     true,
				Default:      "[]",
				Description:  "JSON-encoded array of targeting conditions. Each element should be an object with `attribute`, `operator`, and `value` keys.",
				ValidateFunc: validation.StringIsJSON,
			},
			"project_id": {
				Type:        schema.TypeString,
				Optional:    true,
				Default:     "default",
				Description: "ID of the project that owns this segment.",
			},
		},
	}
}

func resourceSegmentCreate(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	seg := SegmentPayload{
		Key:         d.Get("key").(string),
		Name:        d.Get("name").(string),
		Description: d.Get("description").(string),
		Conditions:  d.Get("conditions").(string),
		ProjectID:   d.Get("project_id").(string),
	}

	created, err := c.CreateSegment(ctx, seg)
	if err != nil {
		return diag.FromErr(err)
	}

	id := created.ID
	if id == "" {
		id = created.Key
	}
	d.SetId(id)

	return resourceSegmentRead(ctx, d, meta)
}

func resourceSegmentRead(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	key := d.Id()
	seg, err := c.GetSegment(ctx, key)
	if err != nil {
		return diag.FromErr(err)
	}
	if seg == nil {
		d.SetId("")
		return nil
	}

	d.Set("key", seg.Key)
	d.Set("name", seg.Name)
	d.Set("description", seg.Description)
	d.Set("conditions", seg.Conditions)
	if seg.ProjectID != "" {
		d.Set("project_id", seg.ProjectID)
	}

	return nil
}

func resourceSegmentUpdate(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	key := d.Id()
	seg := SegmentPayload{
		Key:         d.Get("key").(string),
		Name:        d.Get("name").(string),
		Description: d.Get("description").(string),
		Conditions:  d.Get("conditions").(string),
		ProjectID:   d.Get("project_id").(string),
	}

	_, err := c.UpdateSegment(ctx, key, seg)
	if err != nil {
		return diag.FromErr(err)
	}

	return resourceSegmentRead(ctx, d, meta)
}

func resourceSegmentDelete(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	if err := c.DeleteSegment(ctx, d.Id()); err != nil {
		return diag.FromErr(err)
	}

	d.SetId("")
	return nil
}
