package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type HealthHandler struct {
	DB *sql.DB
}

func NewHealthHandler(db *sql.DB) *HealthHandler {
	return &HealthHandler{DB: db}
}

func (h *HealthHandler) Health(c *gin.Context) {
	dbStatus := "ok"

	if err := h.DB.Ping(); err != nil {
		dbStatus = "error"
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":    "error",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"services": gin.H{
				"gateway":  "ok",
				"database": dbStatus,
			},
			"version": "1.0.0",
			"service": "fintech-gateway",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"services": gin.H{
			"gateway":  "ok",
			"database": dbStatus,
		},
		"version": "1.0.0",
		"service": "fintech-gateway",
	})
}

func (h *HealthHandler) Ready(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ready",
		"service": "fintech-gateway",
	})
}