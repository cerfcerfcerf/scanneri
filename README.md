# MVP: цифровой школьный архив

Минимальное веб-приложение для хранения документов учеников.

## Стек
- **Backend:** FastAPI
- **Frontend:** React + Vite
- **DB:** SQLite
- **OCR:** Tesseract
- **Хранение файлов:** локально на диске (`backend/uploads`)

## Функционал
- Сущность `Student` (`id`, `full_name`, `class_name`)
- Сущность `Document` (`id`, `student_id`, `type`, `year`, `file_path`, `created_at`, `ocr_text`)
- Загрузка PDF и изображений
- Раздельное действие OCR по кнопке **«Распознать текст»**
- Сохранение распознанного текста в БД
- Страница загрузки документа
- Страница списка документов
- Поиск документов по имени ученика
- Страница документа с отображением OCR-текста
- Форма ручного подтверждения/редактирования метаданных документа (тип, год, ученик)

---

## Запуск

### 0) Установить Tesseract

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-rus
```

#### macOS (Homebrew)
```bash
brew install tesseract tesseract-lang
```

### 1) Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend поднимется на `http://localhost:8000`.

### 2) Frontend
Откройте второй терминал:
```bash
cd frontend
npm install
npm run dev
```

Frontend будет на `http://localhost:5173`.

---

## Как пользоваться
1. Добавьте ученика (ФИО и класс).
2. Выберите ученика, укажите тип документа и год, загрузите PDF/изображение.
3. Нажмите **«Распознать текст»** в таблице или на странице документа.
4. На странице документа при необходимости отредактируйте и подтвердите метаданные (тип, год, ученик).
5. Проверьте сохранённый OCR-текст.
