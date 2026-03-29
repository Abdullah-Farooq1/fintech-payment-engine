package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"go.uber.org/zap"

	"fintech-gateway/internal/config"
	"fintech-gateway/internal/handlers"
	"fintech-gateway/internal/middleware"
)

func main() {
	// ── Load config
	cfg := config.Load()

	// ── Initialize structured logger
	logger, err := config.NewLogger(cfg.Environment)
	if err != nil {
		log.Fatalf("❌ Failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	logger.Info("🚀 Starting Fintech API Gateway",
		zap.String("environment", cfg.Environment),
		zap.String("port", cfg.Port),
		zap.String("honoURL", cfg.HonoURL),
	)

	// ── Initialize OpenTelemetry tracer
	tp, err := config.NewTracer("fintech-gateway")
	if err != nil {
		logger.Fatal("Failed to initialize tracer", zap.Error(err))
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		tp.Shutdown(ctx)
	}()

	// ── Connect to PostgreSQL
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("Failed to open database", zap.Error(err))
	}
	defer db.Close()

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}
	logger.Info("✅ Database connected")

	// ── Connect to Redis
	redisClient, err := config.NewRedisClient(cfg.RedisURL)
	if err != nil {
		logger.Fatal("Failed to connect to Redis", zap.Error(err))
	}
	defer redisClient.Close()

	// ── Setup circuit breaker
	circuitBreaker := middleware.NewCircuitBreaker("fintech-api")

	// ── Setup Gin
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// ── Global middleware
	router.Use(middleware.ZapLogger(logger))
	router.Use(middleware.Tracing("fintech-gateway"))
	router.Use(gin.Recovery())

	// ── CORS
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// ── Rate limiter
	rateLimiter := middleware.NewRateLimiter(redisClient, cfg.RateLimit, cfg.RateWindow)
	router.Use(rateLimiter.Limit())

	// ── Handlers
	healthHandler := handlers.NewHealthHandler(db)
	authHandler := handlers.NewAuthHandler(cfg.JWTSecret)
	proxyHandler := handlers.NewProxyHandler(cfg.HonoURL)
	jwtMiddleware := middleware.NewJWTMiddleware(cfg.JWTSecret)

	// ── Public routes
	router.GET("/gateway/health", healthHandler.Health)
	router.GET("/gateway/ready", healthHandler.Ready)
	router.POST("/gateway/token", authHandler.GenerateToken)
	router.GET("/gateway/circuit", circuitBreaker.Status())

	// ── Protected routes
	protected := router.Group("/api")
	protected.Use(jwtMiddleware.Authenticate())
	protected.Use(circuitBreaker.Protect())
	{
		protected.GET("/me", authHandler.Me)

		admin := protected.Group("/admin")
		admin.Use(jwtMiddleware.RequireRole("admin"))
		{
			admin.GET("/accounts", proxyHandler.Forward)
			admin.GET("/ledger/balance", proxyHandler.Forward)
		}

		protected.POST("/payment-intent",
			rateLimiter.LimitPayments(),
			proxyHandler.Forward,
		)
		protected.GET("/transactions/:id", proxyHandler.Forward)
		protected.GET("/accounts/:id", proxyHandler.Forward)
	}

	// ── 404 handler
	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Route not found",
			"service": "fintech-gateway",
		})
	})

	// ── HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// ── Start server
	go func() {
		logger.Info("Gateway started",
			zap.String("address", "http://localhost:"+cfg.Port),
		)
		fmt.Printf("\n✅ Gateway running on http://localhost:%s\n", cfg.Port)
		fmt.Printf("📡 Health    : http://localhost:%s/gateway/health\n", cfg.Port)
		fmt.Printf("🔌 Circuit   : http://localhost:%s/gateway/circuit\n", cfg.Port)
		fmt.Printf("🔑 Token     : http://localhost:%s/gateway/token\n", cfg.Port)
		fmt.Printf("👤 Me        : http://localhost:%s/api/me\n", cfg.Port)
		fmt.Printf("💸 Payments  : http://localhost:%s/api/payment-intent\n\n", cfg.Port)

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Server error", zap.Error(err))
		}
	}()

	// ── Graceful shutdown manager
	shutdownMgr := handlers.NewShutdownManager(srv, logger, 30*time.Second)
	shutdownMgr.WaitAndShutdown(
		func() {
			logger.Info("Closing database connection")
			db.Close()
		},
		func() {
			logger.Info("Closing Redis connection")
			redisClient.Close()
		},
		func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			logger.Info("Flushing traces")
			tp.Shutdown(ctx)
		},
	)
}