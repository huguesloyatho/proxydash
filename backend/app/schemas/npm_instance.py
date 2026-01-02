from pydantic import BaseModel, model_validator
from typing import Optional, Literal
from datetime import datetime


class NpmInstanceBase(BaseModel):
    name: str
    connection_mode: Literal["database", "api"] = "database"
    # Database fields (required if connection_mode = "database")
    db_host: Optional[str] = None
    db_port: int = 5432
    db_name: Optional[str] = None
    db_user: Optional[str] = None
    # API fields (required if connection_mode = "api")
    api_url: Optional[str] = None
    api_email: Optional[str] = None
    priority: int = 100
    is_active: bool = True


class NpmInstanceCreate(NpmInstanceBase):
    db_password: Optional[str] = None
    api_password: Optional[str] = None

    @model_validator(mode='after')
    def validate_connection_fields(self):
        if self.connection_mode == "database":
            if not all([self.db_host, self.db_name, self.db_user, self.db_password]):
                raise ValueError("Pour le mode database, db_host, db_name, db_user et db_password sont requis")
        elif self.connection_mode == "api":
            if not all([self.api_url, self.api_email, self.api_password]):
                raise ValueError("Pour le mode API, api_url, api_email et api_password sont requis")
        return self


class NpmInstanceUpdate(BaseModel):
    name: Optional[str] = None
    connection_mode: Optional[Literal["database", "api"]] = None
    db_host: Optional[str] = None
    db_port: Optional[int] = None
    db_name: Optional[str] = None
    db_user: Optional[str] = None
    db_password: Optional[str] = None
    api_url: Optional[str] = None
    api_email: Optional[str] = None
    api_password: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class NpmInstanceResponse(BaseModel):
    id: int
    name: str
    connection_mode: str
    # Database fields
    db_host: Optional[str] = None
    db_port: int = 5432
    db_name: Optional[str] = None
    db_user: Optional[str] = None
    # API fields
    api_url: Optional[str] = None
    api_email: Optional[str] = None
    # Common fields
    priority: int
    is_active: bool
    is_online: bool
    is_degraded: bool
    last_error: Optional[str] = None
    created_at: datetime
    last_synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True
