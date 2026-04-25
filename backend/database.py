import databases
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/flickertoflow")
database = databases.Database(DATABASE_URL)
