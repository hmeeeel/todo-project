const { useState, useEffect } = React;

const API_BASE = '/api';
const TOKEN_KEY = 'tt_token';
const USER_KEY = 'tt_user';

/*//  хранение токена и пользователя между перезагрузками вкладки
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (err) {
    return null;
  }
}
function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}*/

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { ...options, cache: 'no-store' });

  if (res.status === 401) {
    // сессия истекла или отозвана; после перезагрузки /me вернёт 401 и покажется экран входа
    window.location.reload();
    throw new Error('Сессия истекла, войдите заново');
  }

  return res;
}

function roleLabel(role) {
  if (role === 'admin') return 'Администратор';
  if (role === 'editor') return 'Редактор';
  return 'Наблюдатель';
}

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

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState('list');

  // при открытии страницы спрашиваем сервер, есть ли действующая сессия (cookie)
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { cache: 'no-store' });
        if (res.ok) setUser(await res.json());
      } catch (err) {
        // сервер недоступен, останемся на экране входа
      } finally {
        setChecking(false);
      }
    }
    checkSession();
  }, []);

  function handleLoggedIn(newUser) {
    setUser(newUser);
  }

  async function handleLogout() {
    try {
      await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch (err) {
      // даже если запрос не прошёл, показываем экран входа
    }
    setUser(null);
  }

  if (checking) return <p>Загрузка...</p>;

  if (!user) {
    return <AuthPage onLoggedIn={handleLoggedIn} />;
  }

  const canEdit = user.role === 'admin' || user.role === 'editor';
  const isAdmin = user.role === 'admin';
  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Мои задачи</h1>
          <p className="page-header__date">{user.email} · роль: {roleLabel(user.role)}</p>
        </div>
        <div className="header-actions">
          <button className="button button--secondary" onClick={() => setView(view === 'list' ? 'calendar' : 'list')}>
            {view === 'list' ? 'Календарь' : 'Задачи'}
          </button>
          <button className="button button--secondary" onClick={() => setView('sessions')}>Сессии</button>
          <button className="button button--secondary" onClick={handleLogout}>Выйти</button>
        </div>
      </header>

      {view === 'list' && <TaskListPage canEdit={canEdit} isAdmin={isAdmin} />}
      {view === 'calendar' && <CalendarPage canEdit={canEdit} isAdmin={isAdmin} />}
      {view === 'sessions' && <SessionsPage user={user} />}
    </div>
  );
}

//  экран входа / регистрации / восстановления пароля
function AuthPage({ onLoggedIn }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [resetEmail, setResetEmail] = useState('');

  function switchMode(newMode) {
    setMode(newMode);
    setError(null);
    setInfo(null);
  }

  return (
    <div className="auth-page">
      <h1>Трекер задач</h1>

      {error && <div className="alert">{error}</div>}
      {info && <div className="alert alert--success">{info}</div>}

      {mode === 'login' && (
        <LoginForm onLoggedIn={onLoggedIn} onError={setError} onForgot={() => switchMode('forgot')} />
      )}

      {mode === 'register' && (
        <RegisterForm
          onRegistered={() => { switchMode('login'); setInfo('Регистрация успешна, теперь войдите'); }}
          onError={setError}
        />
      )}

      {mode === 'forgot' && (
        <ForgotPasswordForm
          onCodeSent={email => {
            setResetEmail(email);
            switchMode('reset');
            setInfo('Если такой email зарегистрирован, код отправлен на почту');
          }}
          onError={setError}
        />
      )}

      {mode === 'reset' && (
        <ResetPasswordForm
          email={resetEmail}
          onDone={() => { switchMode('login'); setInfo('Пароль изменён, войдите с новым паролем'); }}
          onError={setError}
        />
      )}

      <div className="auth-page__links">
        {mode !== 'login' && <a href="#" onClick={e => { e.preventDefault(); switchMode('login'); }}>Вход</a>}
        {mode !== 'register' && <a href="#" onClick={e => { e.preventDefault(); switchMode('register'); }}>Регистрация</a>}
      </div>
    </div>
  );
}

function LoginForm({ onLoggedIn, onError, onForgot }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось войти');
      onLoggedIn(data.user);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <label className="task-form__label">
        Email
        <input className="task-form__input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <label className="task-form__label">
        Пароль
        <input className="task-form__input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </label>
      <button type="submit" disabled={busy}>Войти</button>
      <a href="#" onClick={e => { e.preventDefault(); onForgot(); }}>Забыли пароль?</a>
    </form>
  );
}

function RegisterForm({ onRegistered, onError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('editor');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось зарегистрироваться');
      onRegistered();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <label className="task-form__label">
        Email
        <input className="task-form__input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <label className="task-form__label">
        Пароль (минимум 6 символов)
        <input className="task-form__input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </label>
      <label className="task-form__label">
        Роль
        <select className="task-form__input" value={role} onChange={e => setRole(e.target.value)}>
          <option value="editor">Редактор - создаёт и редактирует задачи</option>
          <option value="viewer">Наблюдатель - только просмотр</option>
        </select>
      </label>
      <button type="submit" disabled={busy}>Зарегистрироваться</button>
    </form>
  );
}

function ForgotPasswordForm({ onCodeSent, onError }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось отправить код');
      onCodeSent(email);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <label className="task-form__label">
        Email
        <input className="task-form__input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <button type="submit" disabled={busy}>Отправить код на почту</button>
    </form>
  );
}

function ResetPasswordForm({ email, onDone, onError }) {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сбросить пароль');
      onDone();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <p>Код отправлен на {email || 'вашу почту'}</p>
      <label className="task-form__label">
        Код из письма
        <input className="task-form__input" value={code} onChange={e => setCode(e.target.value)} />
      </label>
      <label className="task-form__label">
        Новый пароль
        <input className="task-form__input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
      </label>
      <button type="submit" disabled={busy}>Сменить пароль</button>
    </form>
  );
}

// список активных сессий
function SessionsPage({ user }) {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function massLogout() {
    const confirmed = window.confirm(
      'Разлогинить ВСЕХ пользователей, кроме вас? Все остальные сессии будут немедленно завершены.'
    );
    if (!confirmed) return;

    try {
      const res = await apiFetch(`${API_BASE}/auth/logout-all`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Не удалось выполнить массовый logout');
      }
    const data = await res.json();
          load();
          alert(`Завершено сессий: ${data.revokedCount}`);
        } catch (err) {
          setError(err.message);
        }
      }

      async function load() {
        setLoading(true);
        try {
          const res = await apiFetch(`${API_BASE}/auth/sessions`);
          if (!res.ok) throw new Error('Не удалось загрузить список сессий');
          setSessions(await res.json());
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }

      useEffect(() => { load(); }, []);

      async function revoke(id) {
        try {
          const res = await apiFetch(`${API_BASE}/auth/sessions/${id}`, { method: 'DELETE' });
          if (!res.ok && res.status !== 204) throw new Error('Не удалось завершить сессию');
          load();
        } catch (err) {
          setError(err.message);
        }
      }

      return (
        <main className="page-content">
      <div className="page-header" style={{ marginBottom: '12px' }}>
        <h2>Активные сессии</h2>
        {user.role === 'admin' && (
          <button type="button" className="button" style={{ background: 'var(--color-danger)' }} onClick={massLogout}>
            Разлогинить всех
          </button>
        )}
      </div>
      {error && <div className="alert">{error}</div>}

      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <ul className="task-list">
          {sessions.map(s => (
            <li className="task-card" key={s.id}>
              <div className="task-card__main">
                <div className="task-card__content">
                  <div className="task-card__title">
                    {s.user_agent || 'Неизвестное устройство'}{s.isCurrent ? ' (текущая)' : ''}
                  </div>
                  <div className="task-card__meta">
                    <span className="task-card__files-count">
                      IP: {s.ip_address || '-'} · последняя активность: {new Date(s.last_active_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                {!s.isCurrent && (
                  <button type="button" className="link-button link-button--danger" onClick={() => revoke(s.id)}>
                    Завершить
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

// страница списка задач
function TaskListPage({ canEdit, isAdmin }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [status, setStatus] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const ribbon = buildRibbon();
  const canCreate = canEdit && selectedDate >= todayStr();

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE}/tasks?date=${selectedDate}&status=${status}`);
      if (!res.ok) throw new Error('Не удалось загрузить задачи');
      setTasks(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTasks(); }, [selectedDate, status]);

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
                   <TaskList tasks={tasks} canEdit={canEdit} isAdmin={isAdmin} onChanged={loadTasks} onError={setError} />
        )}

        {canCreate && (
          <TaskForm dueDate={selectedDate} onCreated={loadTasks} onError={setError} />
        )}
      </main>
    </div>
  );
}

// список задач
function TaskList({ tasks, canEdit, isAdmin, onChanged, onError }) {
  if (tasks.length === 0) {
    return <div className="task-list__empty">Задач нет</div>;
  }

  return (
    <ul className="task-list">
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} canEdit={canEdit} isAdmin={isAdmin} onChanged={onChanged} onError={onError} />
      ))}
    </ul>
  );
}

function TaskCard({ task, canEdit, isAdmin, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleStatus() {
    setBusy(true);
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      const res = await apiFetch(`${API_BASE}/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Не удалось изменить статус');
      }
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
      const res = await apiFetch(`${API_BASE}/tasks/${task.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(data.error || 'Не удалось удалить задачу');
      }
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
            disabled={busy || !canEdit}
            onChange={toggleStatus}
          />
          <span className="task-status-button__circle">✓</span>
        </label>

        <div className="task-card__content">
          <div className="task-card__title">{task.title}</div>
          <div className="task-card__meta">
            <span className="task-card__files-count">Файлов: {task.files.length}</span>
            {isAdmin && task.creator_email && (
              <span className="task-card__files-count"> · создал: {task.creator_email}</span>
            )}
          </div>
        </div>

        {canEdit && (
          <>
            <details className="task-card__details" open={editing}>
              <summary
                className="task-card__edit-button"
                onClick={e => { e.preventDefault(); setEditing(!editing); }}
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
          </>
        )}
      </div>

      {editing && canEdit && (
        <TaskEditForm
          task={task}
          onSaved={() => { setEditing(false); onChanged(); }}
          onError={onError}
        />
      )}
    </li>
  );
}

// форма редактирования задачи
function TaskEditForm({ task, onSaved, onError }) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState(task.status);
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
      const res = await apiFetch(`${API_BASE}/tasks/${task.id}/files/${fileId}`, { method: 'DELETE' });
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
      const res = await apiFetch(`${API_BASE}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Не удалось сохранить задачу');
      }

      if (newFiles.length > 0) {
        const formData = new FormData();
        newFiles.forEach(file => formData.append('attachments', file));

        const filesRes = await apiFetch(`${API_BASE}/tasks/${task.id}/files`, {
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
        <input className="task-form__input" value={title} onChange={e => setTitle(e.target.value)} />
      </label>

      <div className="task-edit-form__status">
        <label>
          <input
            type="checkbox"
            checked={status === 'done'}
            onChange={e => setStatus(e.target.checked ? 'done' : 'todo')}
          />
          {' '}Выполнено
        </label>
      </div>

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
              <span className="task-file__name"> {file.name}</span>
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

// форма создания задачи
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

      const res = await apiFetch(`${API_BASE}/tasks`, { method: 'POST', body: formData });
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

//  страница календаря 
function CalendarPage({ canEdit, isAdmin }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [calendarData, setCalendarData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [error, setError] = useState(null);

  async function loadCalendar() {
    try {
      const res = await apiFetch(`${API_BASE}/calendar?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Не удалось загрузить календарь');
      setCalendarData(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSelectedTasks() {
    try {
      const res = await apiFetch(`${API_BASE}/tasks?date=${selectedDate}&status=all`);
      if (!res.ok) throw new Error('Не удалось загрузить задачи');
      setSelectedTasks(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }
  
  async function refreshAll() {
    await loadCalendar();
    await loadSelectedTasks();
  }

  useEffect(() => { loadCalendar(); }, [year, month]);
  useEffect(() => { loadSelectedTasks(); }, [selectedDate]);

  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); } else { setMonth(month - 1); }
  }
  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); } else { setMonth(month + 1); }
  }

  const canCreate = canEdit && selectedDate >= todayStr();

  if (!calendarData) return <p>Загрузка...</p>;

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

                       <TaskList tasks={selectedTasks} canEdit={canEdit} isAdmin={isAdmin} onChanged={refreshAll} onError={setError} />

        {canCreate ? (
          <TaskForm dueDate={selectedDate} onCreated={refreshAll} onError={setError} />
        ) : (
          canEdit && (
            <div className="calendar-past-message">
              На прошедшую дату нельзя создавать новые задачи.
            </div>
          )
        )}
      </section>
    </div>
  );
}

// ---------- запуск приложения ----------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
