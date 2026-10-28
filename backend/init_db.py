
from database import engine, Base
import models

Base.metadata.create_all(bind=engine)

print("Database initialized successfully!")
print("Documents and FAQs tables are ready.")
