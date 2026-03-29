package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID    string `json:"userId"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	jwt.RegisteredClaims
}

type JWTMiddleware struct {
	Secret string
}

func NewJWTMiddleware(secret string) *JWTMiddleware {
	return &JWTMiddleware{Secret: secret}
}

// ── Validate JWT token from Authorization header
func (j *JWTMiddleware) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Authorization header required",
				"code":    "MISSING_TOKEN",
			})
			return
		}

		// Expect "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid authorization format. Use: Bearer <token>",
				"code":    "INVALID_TOKEN_FORMAT",
			})
			return
		}

		tokenStr := parts[1]

		// Parse and validate token
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(
			tokenStr,
			claims,
			func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return []byte(j.Secret), nil
			},
		)

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid or expired token",
				"code":    "INVALID_TOKEN",
			})
			return
		}

		// Attach claims to context
		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Set("claims", claims)

		c.Next()
	}
}

// ── Require specific role
func (j *JWTMiddleware) RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Role not found in token",
				"code":    "MISSING_ROLE",
			})
			return
		}

		if userRole != role && userRole != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   fmt.Sprintf("Required role: %s", role),
				"code":    "INSUFFICIENT_ROLE",
			})
			return
		}

		c.Next()
	}
}