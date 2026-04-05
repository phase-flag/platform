package phaseflag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// client is a thin HTTP wrapper that talks to the Phase Flag REST API.
type client struct {
	apiURL     string
	apiKey     string
	httpClient *http.Client
}

// newClient creates a new Phase Flag API client.
func newClient(apiURL, apiKey string) *client {
	return &client{
		apiURL: apiURL,
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ---------------------------------------------------------------------------
// Generic HTTP helpers
// ---------------------------------------------------------------------------

func (c *client) doRequest(ctx context.Context, method, path string, body interface{}) ([]byte, int, error) {
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, 0, fmt.Errorf("marshaling request body: %w", err)
		}
		reqBody = bytes.NewBuffer(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.apiURL+path, reqBody)
	if err != nil {
		return nil, 0, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("executing request %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("reading response body: %w", err)
	}

	return respBody, resp.StatusCode, nil
}

// ---------------------------------------------------------------------------
// Flag API
// ---------------------------------------------------------------------------

// FlagPayload represents the JSON body sent to / received from the flag API.
type FlagPayload struct {
	ID          string   `json:"id,omitempty"`
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	FlagType    string   `json:"flag_type,omitempty"`
	Enabled     bool     `json:"enabled"`
	Tags        []string `json:"tags,omitempty"`
	ProjectID   string   `json:"project_id,omitempty"`
}

// CreateFlag creates a new feature flag and returns the server response.
func (c *client) CreateFlag(ctx context.Context, flag FlagPayload) (*FlagPayload, error) {
	data, status, err := c.doRequest(ctx, http.MethodPost, "/api/v1/flags", flag)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", status, string(data))
	}
	var result FlagPayload
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decoding flag response: %w", err)
	}
	return &result, nil
}

// GetFlag retrieves a flag by its key.
func (c *client) GetFlag(ctx context.Context, key string) (*FlagPayload, error) {
	data, status, err := c.doRequest(ctx, http.MethodGet, "/api/v1/flags/"+url.PathEscape(key), nil)
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		return nil, nil // signal "not found" without error
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", status, string(data))
	}
	var result FlagPayload
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decoding flag response: %w", err)
	}
	return &result, nil
}

// UpdateFlag replaces a flag's mutable fields.
func (c *client) UpdateFlag(ctx context.Context, key string, flag FlagPayload) (*FlagPayload, error) {
	data, status, err := c.doRequest(ctx, http.MethodPut, "/api/v1/flags/"+url.PathEscape(key), flag)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", status, string(data))
	}
	var result FlagPayload
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decoding flag response: %w", err)
	}
	return &result, nil
}

// DeleteFlag removes a flag.
func (c *client) DeleteFlag(ctx context.Context, key string) error {
	data, status, err := c.doRequest(ctx, http.MethodDelete, "/api/v1/flags/"+url.PathEscape(key), nil)
	if err != nil {
		return err
	}
	if status == http.StatusNotFound || (status >= 200 && status < 300) {
		return nil
	}
	return fmt.Errorf("API returned status %d: %s", status, string(data))
}

// ListFlags retrieves all flags, optionally filtered by a search query.
func (c *client) ListFlags(ctx context.Context, search string) ([]FlagPayload, error) {
	path := "/api/v1/flags"
	if search != "" {
		path += "?search=" + url.QueryEscape(search)
	}
	data, status, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", status, string(data))
	}
	// The API returns {"flags": [...]} or a plain array; try both.
	var result []FlagPayload
	if err := json.Unmarshal(data, &result); err != nil {
		// Try wrapped envelope
		var envelope struct {
			Flags []FlagPayload `json:"flags"`
		}
		if err2 := json.Unmarshal(data, &envelope); err2 != nil {
			return nil, fmt.Errorf("decoding flags list response: %w", err)
		}
		result = envelope.Flags
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// Project API
// ---------------------------------------------------------------------------

// ProjectPayload represents a Phase Flag project.
type ProjectPayload struct {
	ID          string `json:"id,omitempty"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description,omitempty"`
}

// CreateProject creates a project.
func (c *client) CreateProject(ctx context.Context, p ProjectPayload) (*ProjectPayload, error) {
	data, status, err := c.doRequest(ctx, http.MethodPost, "/api/v1/projects", p)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", status, string(data))
	}
	var result ProjectPayload
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decoding project response: %w", err)
	}
	return &result, nil
}

// GetProject retrieves a project by slug.
func (c *client) GetProject(ctx context.Context, slug string) (*ProjectPayload, error) {
	data, status, err := c.doRequest(ctx, http.MethodGet, "/api/v1/projects/"+url.PathEscape(slug), nil)
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		return nil, nil
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", status, string(data))
	}
	var result ProjectPayload
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decoding project response: %w", err)
	}
	return &result, nil
}

// UpdateProject updates mutable fields of a project.
func (c *client) UpdateProject(ctx context.Context, slug string, p ProjectPayload) (*ProjectPayload, error) {
	data, status, err := c.doRequest(ctx, http.MethodPut, "/api/v1/projects/"+url.PathEscape(slug), p)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", status, string(data))
	}
	var result ProjectPayload
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decoding project response: %w", err)
	}
	return &result, nil
}

// DeleteProject deletes a project.
func (c *client) DeleteProject(ctx context.Context, slug string) error {
	data, status, err := c.doRequest(ctx, http.MethodDelete, "/api/v1/projects/"+url.PathEscape(slug), nil)
	if err != nil {
		return err
	}
	if status == http.StatusNotFound || (status >= 200 && status < 300) {
		return nil
	}
	return fmt.Errorf("API returned status %d: %s", status, string(data))
}

// ---------------------------------------------------------------------------
// Segment API
// ---------------------------------------------------------------------------

// SegmentPayload represents a targeting segment.
type SegmentPayload struct {
	ID          string `json:"id,omitempty"`
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Conditions  string `json:"conditions,omitempty"` // raw JSON string
	ProjectID   string `json:"project_id,omitempty"`
}

// CreateSegment creates a segment.
func (c *client) CreateSegment(ctx context.Context, s SegmentPayload) (*SegmentPayload, error) {
	data, status, err := c.doRequest(ctx, http.MethodPost, "/api/v1/segments", s)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", status, string(data))
	}
	var result SegmentPayload
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decoding segment response: %w", err)
	}
	return &result, nil
}

// GetSegment retrieves a segment by key.
func (c *client) GetSegment(ctx context.Context, key string) (*SegmentPayload, error) {
	data, status, err := c.doRequest(ctx, http.MethodGet, "/api/v1/segments/"+url.PathEscape(key), nil)
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		return nil, nil
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", status, string(data))
	}
	var result SegmentPayload
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decoding segment response: %w", err)
	}
	return &result, nil
}

// UpdateSegment updates mutable fields of a segment.
func (c *client) UpdateSegment(ctx context.Context, key string, s SegmentPayload) (*SegmentPayload, error) {
	data, status, err := c.doRequest(ctx, http.MethodPut, "/api/v1/segments/"+url.PathEscape(key), s)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", status, string(data))
	}
	var result SegmentPayload
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decoding segment response: %w", err)
	}
	return &result, nil
}

// DeleteSegment deletes a segment.
func (c *client) DeleteSegment(ctx context.Context, key string) error {
	data, status, err := c.doRequest(ctx, http.MethodDelete, "/api/v1/segments/"+url.PathEscape(key), nil)
	if err != nil {
		return err
	}
	if status == http.StatusNotFound || (status >= 200 && status < 300) {
		return nil
	}
	return fmt.Errorf("API returned status %d: %s", status, string(data))
}
