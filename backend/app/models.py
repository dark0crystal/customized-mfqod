from sqlmodel import SQLModel , Field


class User(SQLModel , table=True):
    id:str = Field(default=None , primary_key=True)
    name:str