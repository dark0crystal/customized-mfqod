from app.db.database import get_session
from app.models import UserStatus
from sqlalchemy import select

def check_statuses():
    # get_session is a generator, so we iterate over it
    for session in get_session():
        stmt = select(UserStatus)
        result = session.execute(stmt).scalars().all()
        print("Available UserStatuses:")
        for status in result:
            print(f"- {status.name} (ID: {status.id})")
        break

if __name__ == "__main__":
    check_statuses()
