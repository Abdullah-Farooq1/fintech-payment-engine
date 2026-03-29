package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sony/gobreaker"
)

type CircuitBreakerMiddleware struct {
	CB *gobreaker.CircuitBreaker
}

func NewCircuitBreaker(name string) *CircuitBreakerMiddleware {
	settings := gobreaker.Settings{
		Name: name,

		// Open circuit after 5 consecutive failures
		MaxRequests: 5,

		// Wait 30 seconds before trying again (half-open)
		Interval: 30 * time.Second,
		Timeout:  30 * time.Second,

		// Open circuit if >50% of last 10 requests fail
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) /
				float64(counts.Requests)
			return counts.Requests >= 10 && failureRatio >= 0.5
		},

		// Log state changes
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			fmt.Printf("🔌 Circuit Breaker [%s]: %s → %s\n",
				name, from.String(), to.String())
		},
	}

	cb := gobreaker.NewCircuitBreaker(settings)

	return &CircuitBreakerMiddleware{CB: cb}
}

// ── Circuit breaker middleware for Gin
func (cbm *CircuitBreakerMiddleware) Protect() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get current state
		state := cbm.CB.State()

		// Add circuit breaker state header
		c.Header("X-Circuit-Breaker-State", state.String())

		// If circuit is open — reject immediately
		if state == gobreaker.StateOpen {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"error":   "Service temporarily unavailable. Circuit breaker is open.",
				"code":    "CIRCUIT_OPEN",
				"state":   state.String(),
				"retryAfter": 30,
			})
			return
		}

		// Track if this request failed
		failed := false

		// Wrap next handler in circuit breaker
		_, err := cbm.CB.Execute(func() (interface{}, error) {
			c.Next()

			// Consider 5xx responses as failures
			if c.Writer.Status() >= 500 {
				failed = true
				return nil, fmt.Errorf("upstream returned %d", c.Writer.Status())
			}

			return nil, nil
		})

		if err != nil && !failed {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"error":   "Circuit breaker rejected request",
				"code":    "CIRCUIT_REJECTED",
			})
		}
	}
}

// ── Get circuit breaker status
func (cbm *CircuitBreakerMiddleware) Status() gin.HandlerFunc {
	return func(c *gin.Context) {
		counts := cbm.CB.Counts()
		state := cbm.CB.State()

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"state":              state.String(),
				"requests":           counts.Requests,
				"totalSuccesses":     counts.TotalSuccesses,
				"totalFailures":      counts.TotalFailures,
				"consecutiveSuccess": counts.ConsecutiveSuccesses,
				"consecutiveFailure": counts.ConsecutiveFailures,
			},
		})
	}
}