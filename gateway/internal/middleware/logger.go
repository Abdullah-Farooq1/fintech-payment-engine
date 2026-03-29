package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		traceID := fmt.Sprintf("gw_%d", time.Now().UnixNano())

		c.Set("traceID", traceID)
		c.Header("X-Trace-ID", traceID)

		fmt.Printf("→ [%s] %s %s\n", traceID, c.Request.Method, c.Request.URL.Path)

		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()

		fmt.Printf("← [%s] %s %s %d %v\n",
			traceID,
			c.Request.Method,
			c.Request.URL.Path,
			status,
			duration,
		)
	}
}