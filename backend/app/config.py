import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Target LocalStack instance
    localstack_url: str = os.getenv("LOCALSTACK_URL", "http://localhost:4567")
    aws_region: str = os.getenv("AWS_DEFAULT_REGION", "eu-west-1")
    aws_access_key_id: str = os.getenv("AWS_ACCESS_KEY_ID", "test")
    aws_secret_access_key: str = os.getenv("AWS_SECRET_ACCESS_KEY", "test")
    
    # Path to declarative resources YAML
    config_path: str = os.getenv("CONFIG_PATH", "resources.yaml")
    
    # Host & Ports
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "4566"))  # Proxy & API port (standard AWS port)
    
    # Auto creation mode: if True, auto-provisions and returns 200 without waiting for manual UI click
    auto_create_missing: bool = os.getenv("AUTO_CREATE_MISSING", "false").lower() in ("true", "1", "yes")

    class Config:
        env_file = ".env"

settings = Settings()
