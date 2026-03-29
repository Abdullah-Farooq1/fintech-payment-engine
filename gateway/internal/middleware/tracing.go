package middleware

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

func Tracing(serviceName string) gin.HandlerFunc {
	tracer := otel.Tracer(serviceName)

	return func(c *gin.Context) {
		// Start span
		spanName := fmt.Sprintf("%s %s", c.Request.Method, c.FullPath())
		ctx, span := tracer.Start(c.Request.Context(), spanName)
		defer span.End()

		// Add request attributes to span
		span.SetAttributes(
			attribute.String("http.method", c.Request.Method),
			attribute.String("http.url", c.Request.URL.String()),
			attribute.String("http.path", c.Request.URL.Path),
			attribute.String("net.peer.ip", c.ClientIP()),
		)

		// Attach trace context to gin context
		c.Request = c.Request.WithContext(ctx)

		// Add trace ID to response header
		spanCtx := span.SpanContext()
		if spanCtx.IsValid() {
			c.Header("X-Trace-ID", spanCtx.TraceID().String())
			c.Header("X-Span-ID", spanCtx.SpanID().String())
		}

		c.Next()

		// Record response status
		status := c.Writer.Status()
		span.SetAttributes(attribute.Int("http.status_code", status))

		if status >= 500 {
			span.SetStatus(codes.Error, fmt.Sprintf("HTTP %d", status))
		} else {
			span.SetStatus(codes.Ok, "")
		}
	}
}