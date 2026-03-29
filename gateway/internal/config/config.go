package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	DatabaseURL string
	HonoURL     string
	JWTSecret   string
	Environment string
	RedisURL    string
	RateLimit   int
	RateWindow  int
}

func Load() *Config {
	if err := godotenv.Load("../.env"); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	return &Config{
		Port:        getEnv("GATEWAY_PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		HonoURL:     getEnv("HONO_URL", "http://localhost:3000"),
		JWTSecret:   getEnv("JWT_SECRET", "fintech-super-secret-key-change-in-production"),
		Environment: getEnv("ENVIRONMENT", "development"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		RateLimit:   100,
		RateWindow:  60,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}