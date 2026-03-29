package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func ZapLogger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		traceID := fmt.Sprintf("gw_%d", time.Now().UnixNano())

		c.Set("traceID", traceID)
		c.Header("X-Trace-ID", traceID)

		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()

		// Structured log fields
		fields := []zap.Field{
			zap.String("traceId", traceID),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", status),
			zap.Duration("duration", duration),
			zap.String("ip", c.ClientIP()),
			zap.String("userAgent", c.Request.UserAgent()),
		}

		// Add user ID if authenticated
		if userID, exists := c.Get("userID"); exists {
			fields = append(fields, zap.Any("userId", userID))
		}

		// Log based on status code
		if status >= 500 {
			logger.Error("Request failed", fields...)
		} else if status >= 400 {
			logger.Warn("Request client error", fields...)
		} else {
			logger.Info("Request completed", fields...)
		}
	}
}