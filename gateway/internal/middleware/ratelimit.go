package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type RateLimiter struct {
	Redis      *redis.Client
	MaxRequest int
	Window     time.Duration
}

func NewRateLimiter(redisClient *redis.Client, maxRequests int, windowSeconds int) *RateLimiter {
	return &RateLimiter{
		Redis:      redisClient,
		MaxRequest: maxRequests,
		Window:     time.Duration(windowSeconds) * time.Second,
	}
}

// ── Get client IP address
func getClientIP(c *gin.Context) string {
	ip := c.GetHeader("X-Forwarded-For")
	if ip == "" {
		ip = c.GetHeader("X-Real-IP")
	}
	if ip == "" {
		ip = c.ClientIP()
	}
	return ip
}

// ── Rate limit middleware
func (rl *RateLimiter) Limit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := context.Background()
		ip := getClientIP(c)

		// Key per IP per window
		key := fmt.Sprintf("rate_limit:%s", ip)

		// Increment counter
		count, err := rl.Redis.Incr(ctx, key).Result()
		if err != nil {
			// If Redis fails — allow request (fail open)
			fmt.Printf("⚠️  Rate limiter Redis error: %v\n", err)
			c.Next()
			return
		}

		// Set expiry on first request
		if count == 1 {
			rl.Redis.Expire(ctx, key, rl.Window)
		}

		// Get TTL for headers
		ttl, _ := rl.Redis.TTL(ctx, key).Result()
		remaining := rl.MaxRequest - int(count)
		if remaining < 0 {
			remaining = 0
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(rl.MaxRequest))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(ttl).Unix(), 10))

		// Block if exceeded
		if int(count) > rl.MaxRequest {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success":     false,
				"error":       "Rate limit exceeded",
				"code":        "RATE_LIMIT_EXCEEDED",
				"retryAfter":  ttl.Seconds(),
				"limit":       rl.MaxRequest,
				"window":      fmt.Sprintf("%v", rl.Window),
			})
			return
		}

		c.Next()
	}
}

// ── Stricter rate limit for payment endpoints
func (rl *RateLimiter) LimitPayments() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := context.Background()

		// Use user ID if authenticated, otherwise IP
		userID, exists := c.Get("userID")
		var key string
		if exists {
			key = fmt.Sprintf("rate_limit:payment:%v", userID)
		} else {
			key = fmt.Sprintf("rate_limit:payment:%s", getClientIP(c))
		}

		// Payment limit: 10 per minute
		paymentLimit := 10
		window := time.Minute

		count, err := rl.Redis.Incr(ctx, key).Result()
		if err != nil {
			c.Next()
			return
		}

		if count == 1 {
			rl.Redis.Expire(ctx, key, window)
		}

		ttl, _ := rl.Redis.TTL(ctx, key).Result()
		remaining := paymentLimit - int(count)
		if remaining < 0 {
			remaining = 0
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(paymentLimit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(ttl).Unix(), 10))

		if int(count) > paymentLimit {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success":    false,
				"error":      "Payment rate limit exceeded. Max 10 payments per minute.",
				"code":       "PAYMENT_RATE_LIMIT_EXCEEDED",
				"retryAfter": ttl.Seconds(),
			})
			return
		}

		c.Next()
	}
}