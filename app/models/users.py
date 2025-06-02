from ..database import Base
from sqlalchemy import Column, Integer, String, TIMESTAMP, Boolean, text, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

class OrangeUser(Base):
    __tablename__ = "orange_users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(String(255), unique=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('CURRENT_TIMESTAMP'))
    push_subscription = Column(JSONB)
    name = Column(String, server_default=text("'Friend'"))
    streak = Column(Integer, server_default=text('0'))
    actions = Column(Integer, server_default=text('0'))
    level = Column(Integer, server_default=text('1'))
    daily_quote_count = Column(Integer, server_default=text('0'))
    games_played = Column(Integer, server_default=text('0'))
    tarot_draws = Column(Integer, server_default=text('0'))
    last_login = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    is_admin = Column(Boolean, server_default=text('false'))
    is_banned = Column(Boolean, server_default=text('false'))
    food_points = Column(Integer, server_default=text('0'))
    food_streak = Column(Integer, server_default=text('0'))
    gender = Column(String)
    is_special_moodboard_allowed = Column(Boolean, server_default=text('false'))
    weekly_spends = Column(ARRAY(Integer))
    today_expense = Column(Integer, server_default=text('0'))