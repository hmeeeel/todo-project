const { useState, useEffect } = React;

const API_BASE = '/api';

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return formatDate(d);
}

function buildRibbon() {
  const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  const ribbon = [];
  for (let offset = -3; offset <= 3; offset++) {
    const date = new Date(base);
    date.setDate(date.getDate() + offset);
    ribbon.push({
      dateStr: formatDate(date),
      dayNumber: date.getDate(),
      weekday: weekdays[date.getDay()],
      isToday: offset === 0
    });
  }
  return ribbon;
}

// ---------- корневой компонент ----------
function App() {
  const [view, setView] = useState('list'); // 'list' | 'calendar'

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Мои задачи</h1>
        </div>
        <button
          className="button button--secondary"
          onClick={() => setView(view === 'list' ? 'calendar' : 'list')}
        >
          {view === 'list' ? 'Календарь' : 'Задачи'}
        </button>
      </header>

      {view === 'list' ? <TaskListPage /> : <CalendarPage />}
    </div>
  );
}

// ---------- страница списка задач ----------
function TaskListPage() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [status, setStatus] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const ribbon = buildRibbon();
  const canCreate = selectedDate >= todayStr();

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/tasks?date=${selectedDate}&status=${status}`);
      if (!res.ok) throw new Error('Не удалось загрузить задачи');
      setTasks(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, [selectedDate, status]);

  return (
    <div>
      {error && <div className="alert">{error}</div>}

      <div className="ribbon">
        {ribbon.map(day => (
          <button
            key={day.dateStr}
            className={
              'ribbon__day' +
              (day.isToday ? ' ribbon__day--today' : '') +
              (day.dateStr === selectedDate ? ' ribbon__day--active' : '')
            }
            onClick={() => setSelectedDate(day.dateStr)}
          >
            <span className="ribbon__weekday">{day.weekday}</span>
            <span className="ribbon__number">{day.dayNumber}</span>
          </button>
        ))}
      </div>

      <div className="status-filter">
        {['all', 'todo', 'done'].map(s => (
          <button
            key={s}
            className={
              'status-filter__button' +
              (status === s ? ' status-filter__button--active' : '')
            }
            onClick={() => setStatus(s)}
          >
            {s === 'all' ? 'Все' : s === 'todo' ? 'Запланированные' : 'Выполненные'}
          </button>
        ))}
      </div>

      <main className="page-content">
        {loading ? (
          <p>Загрузка...</p>
        ) : (
          <TaskList tasks={tasks} onChanged={loadTasks} onError={setError} />
        )}

        {canCreate && (
          <TaskForm dueDate={selectedDate} onCreated={loadTasks} onError={setError} />
        )}
      </main>
    </div>
  );
}

// ---------- список задач ----------
function TaskList({ tasks, onChanged, onError }) {
  if (tasks.length === 0) {
    return <div className="task-list__empty">Задач нет</div>;
  }

  return (
    <ul className="task-list">
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} onChanged={onChanged} onError={onError} />
      ))}
    </ul>
  );
}

function TaskCard({ task, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleStatus() {
    setBusy(true);
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      const res = await fetch(`${API_BASE}/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Не удалось изменить статус');
      onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/${task.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Не удалось удалить задачу');
      onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`task-card task-card--${task.status}`}>
      <div className="task-card__main">
        <label className="task-status-button">
          <input
            type="checkbox"
            checked={task.status === 'done'}
            disabled={busy}
            onChange={toggleStatus}
          />
          <span className="task-status-button__circle"> </span>
        </label>

        <div className="task-card__content">
          <div className="task-card__title">{task.title}</div>
          <div className="task-card__meta">
            <span className="task-card__files-count">Файлов: {task.files.length}</span>
          </div>
        </div>

        <details className="task-card__details" open={editing}>
          <summary
            className="task-card__edit-button"
            onClick={e => {
              e.preventDefault();
              setEditing(!editing);
            }}
          >
            Изменить
          </summary>
        </details>

        <button
          type="button"
          className="link-button link-button--danger"
          disabled={busy}
          onClick={deleteTask}
        >
          Удалить
        </button>
      </div>

      {editing && (
        <TaskEditForm
          task={task}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
          onError={onError}
        />
      )}
    </li>
  );
}

// ---------- форма редактирования задачи ----------
function TaskEditForm({ task, onSaved, onError }) {
  const [title, setTitle] = useState(task.title);
  const [files, setFiles] = useState(task.files);
  const [newFiles, setNewFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  function handleFilesSelected(e) {
    const selected = Array.from(e.target.files);
    const availableSlots = 3 - files.length - newFiles.length;

    if (availableSlots <= 0) {
      onError('Можно прикрепить максимум 3 файла');
      e.target.value = '';
      return;
    }

    setNewFiles([...newFiles, ...selected.slice(0, availableSlots)]);
    e.target.value = '';
  }

  async function deleteExistingFile(fileId) {
    try {
      const res = await fetch(`${API_BASE}/tasks/${task.id}/files/${fileId}`, {
        method: 'DELETE'
      });
      if (!res.ok && res.status !== 204) throw new Error('Не удалось удалить файл');
      setFiles(files.filter(f => f.id !== fileId));
    } catch (err) {
      onError(err.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status: task.status })  // ← используем ТЕКУЩИЙ статус
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Не удалось сохранить задачу');
      }

      if (newFiles.length > 0) {
        const formData = new FormData();
        newFiles.forEach(file => formData.append('attachments', file));

        const filesRes = await fetch(`${API_BASE}/tasks/${task.id}/files`, {
          method: 'POST',
          body: formData
        });
        if (!filesRes.ok) {
          const data = await filesRes.json();
          throw new Error(data.error || 'Не удалось загрузить файлы');
        }
      }

      onSaved();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="task-edit-form" onSubmit={save}>
      <label className="task-form__label">
        Название
        <input
          className="task-form__input"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </label>

      { }

      <div className="task-files">
        <div className="task-files__title">Файлы</div>

        <div className="task-files__list">
          {files.map(file => (
            <div className="task-file" key={file.id}>
              <a href={`/uploads/${file.stored_name}`} target="_blank" rel="noreferrer">
                {file.original_name}
              </a>
              <button
                type="button"
                className="link-button link-button--danger"
                onClick={() => deleteExistingFile(file.id)}
              >
                Удалить
              </button>
            </div>
          ))}

          {newFiles.map((file, index) => (
            <div className="task-file task-file--new" key={index}>
              <span className="task-file__name">{file.name}</span>
              <button
                type="button"
                className="link-button link-button--danger"
                onClick={() => setNewFiles(newFiles.filter((_, i) => i !== index))}
              >
                Удалить
              </button>
            </div>
          ))}

          {files.length === 0 && newFiles.length === 0 && (
            <div className="task-files__empty">Файлов нет</div>
          )}
        </div>

        {files.length + newFiles.length < 3 && (
          <input className="file-input" type="file" multiple onChange={handleFilesSelected} />
        )}
      </div>

      <button type="submit" disabled={busy}>Сохранить</button>
    </form>
  );
}

// ---------- форма создания задачи ----------
function TaskForm({ dueDate, onCreated, onError }) {
  const [title, setTitle] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  function handleFilesSelected(e) {
    const selected = Array.from(e.target.files);
    const availableSlots = 3 - files.length;

    if (availableSlots <= 0) {
      onError('Можно прикрепить максимум 3 файла');
      e.target.value = '';
      return;
    }

    setFiles([...files, ...selected.slice(0, availableSlots)]);
    e.target.value = '';
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('dueDate', dueDate);
      files.forEach(file => formData.append('attachments', file));

      const res = await fetch(`${API_BASE}/tasks`, { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Не удалось создать задачу');
      }

      setTitle('');
      setFiles([]);
      onCreated();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="add-task">
      <summary>Добавить задачу</summary>

      <form className="task-form" onSubmit={submit}>
        <label className="task-form__label">
          Название задачи
          <input
            className="task-form__input"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </label>

        <div className="file-picker">
          <input className="file-input" type="file" multiple onChange={handleFilesSelected} />
          <span className="file-picker__hint">до 3 файлов</span>
        </div>

        {files.length > 0 && (
          <div className="task-files__list">
            {files.map((file, index) => (
              <div className="task-file" key={index}>
                <span className="task-file__name">{file.name}</span>
                <button
                  type="button"
                  className="link-button link-button--danger"
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={busy}>Добавить</button>
      </form>
    </details>
  );
}


// ---------- страница календаря ----------
function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [calendarData, setCalendarData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [error, setError] = useState(null);

  async function loadCalendar() {
    try {
      const res = await fetch(`${API_BASE}/calendar?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Не удалось загрузить календарь');
      setCalendarData(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSelectedTasks() {
    try {
      const res = await fetch(`${API_BASE}/tasks?date=${selectedDate}&status=all`);
      if (!res.ok) throw new Error('Не удалось загрузить задачи');
      setSelectedTasks(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshAll() {
    await Promise.all([loadCalendar(), loadSelectedTasks()]);
  }

  useEffect(() => { loadCalendar(); }, [year, month]);
  useEffect(() => { loadSelectedTasks(); }, [selectedDate]);

  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); } else { setMonth(month - 1); }
  }
  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); } else { setMonth(month + 1); }
  }

  const canCreate = selectedDate >= todayStr();

  if (!calendarData) return <p>Загрузка.</p>;

  return (
    <div>
      {error && <div className="alert">{error}</div>}

      <nav className="month-nav">
        <a href="#" onClick={e => { e.preventDefault(); prevMonth(); }}>Предыдущий</a>
        <div className="month-nav__title">{calendarData.monthName} {year}</div>
        <a href="#" onClick={e => { e.preventDefault(); nextMonth(); }}>Следующий</a>
      </nav>

      <table className="calendar-grid">
        <thead>
          <tr>
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {calendarData.weeks.map((week, i) => (
            <tr key={i}>
              {week.map(day => (
                <td
                  key={day.dateStr}
                  className={
                    'calendar-cell' +
                    (!day.inCurrentMonth ? ' calendar-cell--other-month' : '') +
                    (day.isToday ? ' calendar-cell--today' : '') +
                    (day.dateStr === selectedDate ? ' calendar-cell--selected' : '')
                  }
                  onClick={() => setSelectedDate(day.dateStr)}
                >
                  <span className="calendar-cell__number">{day.dayNumber}</span>
                  <div className="calendar-cell__tasks">
                    {(calendarData.tasksByDate[day.dateStr] || []).map(task => (
                      <div key={task.id} className={`calendar-task calendar-task--${task.status}`}>
                        {task.title}
                      </div>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <section className="calendar-selected">
        <h2>Задачи на {selectedDate}</h2>

        { }
        <TaskList tasks={selectedTasks} onChanged={refreshAll} onError={setError} />

        {canCreate ? (
          <TaskForm dueDate={selectedDate} onCreated={refreshAll} onError={setError} />
        ) : (
          <div className="calendar-past-message">
            На прошедшую дату нельзя создавать новые задачи.
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- запуск приложения ----------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
