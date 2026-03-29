package handlers

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type ProxyHandler struct {
	HonoURL    string
	HTTPClient *http.Client
}

func NewProxyHandler(honoURL string) *ProxyHandler {
	return &ProxyHandler{
		HonoURL: honoURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

// ── Forward request to Hono.js API
func (p *ProxyHandler) Forward(c *gin.Context) {
	// Build target URL
	path := c.Request.URL.Path

	// Strip /api prefix when forwarding to Hono
	// /api/payment-intent → /payment-intent
	// /api/admin/accounts → /accounts
	// /api/admin/ledger/balance → /ledger/balance
	if len(path) > 4 && path[:4] == "/api" {
		path = path[4:]
	}
	if len(path) > 6 && path[:6] == "/admin" {
		path = path[6:]
	}

	targetURL := fmt.Sprintf("%s%s", p.HonoURL, path)

	if c.Request.URL.RawQuery != "" {
		targetURL += "?" + c.Request.URL.RawQuery
	}

	fmt.Printf("🔀 Proxying: %s %s → %s\n",
		c.Request.Method, c.Request.URL.Path, targetURL)

	// Create forwarded request
	req, err := http.NewRequestWithContext(
		c.Request.Context(),
		c.Request.Method,
		targetURL,
		c.Request.Body,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create proxy request",
		})
		return
	}

	// Forward original headers
	req.Header = c.Request.Header.Clone()

	// Add gateway identity headers
	traceID, _ := c.Get("traceID")
	userID, _ := c.Get("userID")
	role, _ := c.Get("role")

	req.Header.Set("X-Gateway-Trace-ID", fmt.Sprintf("%v", traceID))
	req.Header.Set("X-Gateway-User-ID", fmt.Sprintf("%v", userID))
	req.Header.Set("X-Gateway-Role", fmt.Sprintf("%v", role))
	req.Header.Set("X-Forwarded-By", "fintech-gateway")
	req.Header.Del("Authorization")

	// Execute request
	resp, err := p.HTTPClient.Do(req)
	if err != nil {
		fmt.Printf("❌ Proxy error: %v\n", err)
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"error":   "Upstream service unavailable",
			"code":    "UPSTREAM_ERROR",
			"service": "fintech-gateway",
		})
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			c.Header(key, value)
		}
	}

	// Add gateway trace header
	c.Header("X-Gateway-Trace-ID", fmt.Sprintf("%v", traceID))

	// Copy response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to read upstream response",
		})
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json"
	}

	c.Data(resp.StatusCode, contentType, body)
}