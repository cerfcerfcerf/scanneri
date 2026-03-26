from datetime import datetime

from pydantic import BaseModel


class StudentCreate(BaseModel):
    full_name: str
    class_name: str


class StudentRead(BaseModel):
    id: int
    full_name: str
    class_name: str

    class Config:
        from_attributes = True


class DocumentUpdate(BaseModel):
    student_id: int
    type: str
    year: int


class DocumentRead(BaseModel):
    id: int
    student_id: int
    type: str
    year: int
    file_path: str
    created_at: datetime
    ocr_text: str | None
    student: StudentRead

    class Config:
        from_attributes = True
