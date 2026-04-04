package main

import (
	"sync"
	"time"
)

// CacheEntry holds a cached value with metadata.
type CacheEntry struct {
	Data      []byte
	ETag      string
	FetchedAt time.Time
	TTL       time.Duration
}

// IsStale returns true if the entry has exceeded its TTL.
func (e *CacheEntry) IsStale() bool {
	return time.Since(e.FetchedAt) > e.TTL
}

// RulesetCache provides thread-safe in-memory caching of rulesets.
type RulesetCache struct {
	mu         sync.RWMutex
	entries    map[string]*CacheEntry
	defaultTTL time.Duration
	maxEntries int
}

// NewRulesetCache creates a new cache with the given TTL and max entries.
func NewRulesetCache(defaultTTL time.Duration, maxEntries int) *RulesetCache {
	return &RulesetCache{
		entries:    make(map[string]*CacheEntry),
		defaultTTL: defaultTTL,
		maxEntries: maxEntries,
	}
}

// Get retrieves a cache entry by key. Returns nil if not found or stale.
func (c *RulesetCache) Get(key string) *CacheEntry {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[key]
	if !ok {
		return nil
	}

	return entry
}

// GetFresh retrieves a cache entry only if it is not stale.
func (c *RulesetCache) GetFresh(key string) *CacheEntry {
	entry := c.Get(key)
	if entry == nil || entry.IsStale() {
		return nil
	}
	return entry
}

// Set stores or updates a cache entry.
func (c *RulesetCache) Set(key string, data []byte, etag string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Evict oldest if at capacity
	if len(c.entries) >= c.maxEntries {
		if _, exists := c.entries[key]; !exists {
			c.evictOldest()
		}
	}

	c.entries[key] = &CacheEntry{
		Data:      data,
		ETag:      etag,
		FetchedAt: time.Now(),
		TTL:       c.defaultTTL,
	}
}

// GetETag returns the ETag for a cached entry, or empty string if not cached.
func (c *RulesetCache) GetETag(key string) string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.entries[key]
	if !ok {
		return ""
	}
	return entry.ETag
}

// Invalidate removes a specific cache entry.
func (c *RulesetCache) Invalidate(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, key)
}

// InvalidateAll clears the entire cache.
func (c *RulesetCache) InvalidateAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]*CacheEntry)
}

// Size returns the number of entries in the cache.
func (c *RulesetCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}

// Stats returns cache statistics.
func (c *RulesetCache) Stats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	stale := 0
	fresh := 0
	for _, entry := range c.entries {
		if entry.IsStale() {
			stale++
		} else {
			fresh++
		}
	}

	return map[string]interface{}{
		"total":     len(c.entries),
		"fresh":     fresh,
		"stale":     stale,
		"max":       c.maxEntries,
		"ttl_secs":  c.defaultTTL.Seconds(),
	}
}

// evictOldest removes the oldest entry from the cache. Must hold write lock.
func (c *RulesetCache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time

	for key, entry := range c.entries {
		if oldestKey == "" || entry.FetchedAt.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.FetchedAt
		}
	}

	if oldestKey != "" {
		delete(c.entries, oldestKey)
	}
}
