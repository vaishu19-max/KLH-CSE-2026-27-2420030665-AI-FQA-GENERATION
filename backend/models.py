
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20))
    file_size = Column(Integer)
    uploaded_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    faqs = relationship(
        "FAQ",
        back_populates="document",
        cascade="all, delete-orphan"
    )


class FAQ(Base):
    __tablename__ = "faqs"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    category = Column(String(100), default="General")
    source = Column(String(255))

    document_id = Column(
        Integer,
        ForeignKey("documents.id"),
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    document = relationship("Document", back_populates="faqs")
