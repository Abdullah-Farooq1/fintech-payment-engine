package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"
)

type ShutdownManager struct {
	Server  *http.Server
	Logger  *zap.Logger
	Timeout time.Duration
}

func NewShutdownManager(
	server *http.Server,
	logger *zap.Logger,
	timeout time.Duration,
) *ShutdownManager {
	return &ShutdownManager{
		Server:  server,
		Logger:  logger,
		Timeout: timeout,
	}
}

// ── Wait for signal and shutdown gracefully
func (sm *ShutdownManager) WaitAndShutdown(cleanupFns ...func()) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	sig := <-quit
	sm.Logger.Info("Shutdown signal received",
		zap.String("signal", sig.String()),
	)

	fmt.Println("\n⏳ Shutting down gateway gracefully...")
	fmt.Printf("   Waiting up to %v for in-flight requests...\n", sm.Timeout)

	ctx, cancel := context.WithTimeout(context.Background(), sm.Timeout)
	defer cancel()

	// Stop accepting new requests
	if err := sm.Server.Shutdown(ctx); err != nil {
		sm.Logger.Error("Forced shutdown",
			zap.Error(err),
		)
	}

	// Run cleanup functions
	for _, fn := range cleanupFns {
		fn()
	}

	sm.Logger.Info("Gateway stopped cleanly")
	fmt.Println("✅ Gateway stopped cleanly")
}