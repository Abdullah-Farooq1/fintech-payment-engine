package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"fintech-gateway/internal/middleware"
)

type AuthHandler struct {
	JWTSecret string
}

func NewAuthHandler(secret string) *AuthHandler {
	return &AuthHandler{JWTSecret: secret}
}

type TokenRequest struct {
	UserID string `json:"userId" binding:"required"`
	Email  string `json:"email" binding:"required"`
	Role   string `json:"role" binding:"required"`
}

// ── POST /gateway/token — generate a test JWT token
func (h *AuthHandler) GenerateToken(c *gin.Context) {
	var req TokenRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "userId, email and role are required",
		})
		return
	}

	// Validate role
	validRoles := map[string]bool{
		"admin":    true,
		"merchant": true,
		"customer": true,
	}

	if !validRoles[req.Role] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid role. Must be: admin, merchant, or customer",
		})
		return
	}

	// Create claims
	claims := &middleware.Claims{
		UserID: req.UserID,
		Email:  req.Email,
		Role:   req.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "fintech-gateway",
		},
	}

	// Sign token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(h.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate token",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"token":     tokenStr,
		"expiresIn": "24h",
		"tokenType": "Bearer",
		"claims": gin.H{
			"userId": req.UserID,
			"email":  req.Email,
			"role":   req.Role,
		},
	})
}

// ── GET /gateway/me — get current user from token
func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("userID")
	email, _ := c.Get("email")
	role, _ := c.Get("role")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"userId": userID,
			"email":  email,
			"role":   role,
		},
	})
}