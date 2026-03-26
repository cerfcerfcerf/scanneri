import { useEffect, useMemo, useState } from 'react'

const API_URL = 'http://localhost:8000'

function App() {
  const [students, setStudents] = useState([])
  const [documents, setDocuments] = useState([])
  const [search, setSearch] = useState('')
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [editForm, setEditForm] = useState({ student_id: '', type: '', year: '' })
  const [studentForm, setStudentForm] = useState({ full_name: '', class_name: '' })
  const [docForm, setDocForm] = useState({ student_id: '', type: '', year: new Date().getFullYear(), file: null })

  const canUpload = useMemo(
    () => docForm.student_id && docForm.type.trim() && docForm.year && docForm.file,
    [docForm],
  )

  async function loadStudents() {
    const res = await fetch(`${API_URL}/students`)
    setStudents(await res.json())
  }

  async function loadDocuments(query = '') {
    const url = query ? `${API_URL}/documents?search=${encodeURIComponent(query)}` : `${API_URL}/documents`
    const res = await fetch(url)
    setDocuments(await res.json())
  }

  async function loadDocumentById(documentId) {
    const res = await fetch(`${API_URL}/documents/${documentId}`)
    const data = await res.json()
    setSelectedDocument(data)
    setEditForm({ student_id: String(data.student_id), type: data.type, year: String(data.year) })
  }

  useEffect(() => {
    loadStudents()
    loadDocuments()
  }, [])

  async function createStudent(e) {
    e.preventDefault()
    await fetch(`${API_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentForm),
    })
    setStudentForm({ full_name: '', class_name: '' })
    await loadStudents()
  }

  async function uploadDocument(e) {
    e.preventDefault()
    const formData = new FormData()
    formData.append('student_id', docForm.student_id)
    formData.append('type', docForm.type)
    formData.append('year', String(docForm.year))
    formData.append('file', docForm.file)

    const res = await fetch(`${API_URL}/documents`, {
      method: 'POST',
      body: formData,
    })
    const created = await res.json()

    setDocForm({ student_id: '', type: '', year: new Date().getFullYear(), file: null })
    await loadDocuments(search)
    await loadDocumentById(created.id)
  }

  async function onSearchSubmit(e) {
    e.preventDefault()
    await loadDocuments(search)
  }

  async function runOcr(documentId) {
    const res = await fetch(`${API_URL}/documents/${documentId}/ocr`, {
      method: 'POST',
    })
    const updated = await res.json()
    setDocuments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setSelectedDocument(updated)
    setEditForm({ student_id: String(updated.student_id), type: updated.type, year: String(updated.year) })
  }

  async function saveDocumentMetadata(e) {
    e.preventDefault()
    if (!selectedDocument) return

    const res = await fetch(`${API_URL}/documents/${selectedDocument.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: Number(editForm.student_id),
        type: editForm.type,
        year: Number(editForm.year),
      }),
    })

    const updated = await res.json()
    setDocuments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setSelectedDocument(updated)
    setEditForm({ student_id: String(updated.student_id), type: updated.type, year: String(updated.year) })
  }

  return (
    <main className="container">
      <h1>Цифровой школьный архив</h1>

      <section className="card">
        <h2>1) Добавить ученика</h2>
        <form onSubmit={createStudent} className="form-grid">
          <input
            placeholder="ФИО"
            value={studentForm.full_name}
            onChange={(e) => setStudentForm((v) => ({ ...v, full_name: e.target.value }))}
            required
          />
          <input
            placeholder="Класс (например, 9А)"
            value={studentForm.class_name}
            onChange={(e) => setStudentForm((v) => ({ ...v, class_name: e.target.value }))}
            required
          />
          <button type="submit">Сохранить ученика</button>
        </form>
      </section>

      <section className="card">
        <h2>2) Загрузка документа</h2>
        <form onSubmit={uploadDocument} className="form-grid">
          <select
            value={docForm.student_id}
            onChange={(e) => setDocForm((v) => ({ ...v, student_id: e.target.value }))}
            required
          >
            <option value="">Выберите ученика</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name} ({student.class_name})
              </option>
            ))}
          </select>

          <input
            placeholder="Тип документа (например, Табель)"
            value={docForm.type}
            onChange={(e) => setDocForm((v) => ({ ...v, type: e.target.value }))}
            required
          />

          <input
            type="number"
            placeholder="Год"
            value={docForm.year}
            onChange={(e) => setDocForm((v) => ({ ...v, year: e.target.value }))}
            required
          />

          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setDocForm((v) => ({ ...v, file: e.target.files?.[0] ?? null }))}
            required
          />

          <button type="submit" disabled={!canUpload}>
            Загрузить файл
          </button>
        </form>
      </section>

      <section className="card">
        <h2>3) Список документов</h2>
        <form onSubmit={onSearchSubmit} className="search-row">
          <input
            placeholder="Поиск по имени ученика"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">Найти</button>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              loadDocuments('')
            }}
          >
            Сбросить
          </button>
        </form>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Ученик</th>
              <th>Класс</th>
              <th>Тип</th>
              <th>Год</th>
              <th>Файл</th>
              <th>OCR</th>
              <th>Создан</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.id}</td>
                <td>{doc.student.full_name}</td>
                <td>{doc.student.class_name}</td>
                <td>{doc.type}</td>
                <td>{doc.year}</td>
                <td>
                  <a href={`${API_URL}${doc.file_path}`} target="_blank" rel="noreferrer">
                    Открыть
                  </a>
                </td>
                <td>
                  <button type="button" onClick={() => runOcr(doc.id)}>
                    Распознать текст
                  </button>
                </td>
                <td>{new Date(doc.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>4) Страница документа</h2>
        <div className="search-row doc-actions">
          <select
            value={selectedDocument?.id ?? ''}
            onChange={(e) => (e.target.value ? loadDocumentById(e.target.value) : setSelectedDocument(null))}
          >
            <option value="">Выберите документ</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                #{doc.id} — {doc.student.full_name} — {doc.type}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedDocument}
            onClick={() => selectedDocument && runOcr(selectedDocument.id)}
          >
            Распознать текст
          </button>
        </div>

        {selectedDocument && (
          <>
            <form className="form-grid" onSubmit={saveDocumentMetadata}>
              <select
                value={editForm.student_id}
                onChange={(e) => setEditForm((v) => ({ ...v, student_id: e.target.value }))}
                required
              >
                <option value="">Выберите ученика</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name} ({student.class_name})
                  </option>
                ))}
              </select>

              <input
                value={editForm.type}
                onChange={(e) => setEditForm((v) => ({ ...v, type: e.target.value }))}
                placeholder="Тип документа"
                required
              />

              <input
                type="number"
                value={editForm.year}
                onChange={(e) => setEditForm((v) => ({ ...v, year: e.target.value }))}
                placeholder="Год"
                required
              />

              <button type="submit">Подтвердить метаданные</button>
            </form>

            <article className="document-view">
              <p>
                <strong>Ученик:</strong> {selectedDocument.student.full_name} ({selectedDocument.student.class_name})
              </p>
              <p>
                <strong>Тип:</strong> {selectedDocument.type} ({selectedDocument.year})
              </p>
              <p>
                <strong>OCR-текст:</strong>
              </p>
              <pre>{selectedDocument.ocr_text || 'Текст пока не распознан.'}</pre>
            </article>
          </>
        )}
      </section>
    </main>
  )
}

export default App
