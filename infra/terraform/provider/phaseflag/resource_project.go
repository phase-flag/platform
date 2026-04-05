package phaseflag

import (
	"context"

	"github.com/hashicorp/terraform-plugin-sdk/v2/diag"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/validation"
)

func resourceProject() *schema.Resource {
	return &schema.Resource{
		Description:   "Manages a project in Phase Flag. Projects group environments and flags.",
		CreateContext: resourceProjectCreate,
		ReadContext:   resourceProjectRead,
		UpdateContext: resourceProjectUpdate,
		DeleteContext: resourceProjectDelete,
		Importer: &schema.ResourceImporter{
			StateContext: schema.ImportStatePassthroughContext,
		},
		Schema: map[string]*schema.Schema{
			"name": {
				Type:         schema.TypeString,
				Required:     true,
				Description:  "Human-readable name of the project.",
				ValidateFunc: validation.StringIsNotEmpty,
			},
			"slug": {
				Type:         schema.TypeString,
				Required:     true,
				ForceNew:     true,
				Description:  "URL-safe slug for the project (e.g. `my-project`). Changing this forces a new resource.",
				ValidateFunc: validation.StringIsNotEmpty,
			},
			"description": {
				Type:        schema.TypeString,
				Optional:    true,
				Default:     "",
				Description: "Optional description of the project.",
			},
		},
	}
}

func resourceProjectCreate(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	project := ProjectPayload{
		Name:        d.Get("name").(string),
		Slug:        d.Get("slug").(string),
		Description: d.Get("description").(string),
	}

	created, err := c.CreateProject(ctx, project)
	if err != nil {
		return diag.FromErr(err)
	}

	id := created.ID
	if id == "" {
		id = created.Slug
	}
	d.SetId(id)

	return resourceProjectRead(ctx, d, meta)
}

func resourceProjectRead(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	slug := d.Id()
	project, err := c.GetProject(ctx, slug)
	if err != nil {
		return diag.FromErr(err)
	}
	if project == nil {
		d.SetId("")
		return nil
	}

	d.Set("name", project.Name)
	d.Set("slug", project.Slug)
	d.Set("description", project.Description)

	return nil
}

func resourceProjectUpdate(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	slug := d.Id()
	project := ProjectPayload{
		Name:        d.Get("name").(string),
		Slug:        d.Get("slug").(string),
		Description: d.Get("description").(string),
	}

	_, err := c.UpdateProject(ctx, slug, project)
	if err != nil {
		return diag.FromErr(err)
	}

	return resourceProjectRead(ctx, d, meta)
}

func resourceProjectDelete(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	c := meta.(*client)

	if err := c.DeleteProject(ctx, d.Id()); err != nil {
		return diag.FromErr(err)
	}

	d.SetId("")
	return nil
}
