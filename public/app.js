const dateElement = document.getElementById('walk-date');
const slotsElement = document.getElementById('slots');
const slotsNoticeElement = document.getElementById('slots-notice');
const feedingLastElement = document.getElementById('feeding-last');
const feedingNoticeElement = document.getElementById('feeding-notice');
const feedingFormElement = document.getElementById('feeding-form');

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(isoDateTime) {
  return new Date(isoDateTime).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showNotice(element, text, type) {
  element.textContent = text;
  element.className = `notice notice_${type}`;
  element.hidden = false;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, data: await response.json() };
}

function createNameForm({ label, buttonText, onSubmit }) {
  const form = document.createElement('form');
  form.className = 'name-form';

  const input = document.createElement('input');
  input.className = 'name-form__input';
  input.name = 'name';
  input.type = 'text';
  input.required = true;
  input.maxLength = 100;
  input.placeholder = 'ФИО';
  input.setAttribute('aria-label', label);

  const button = document.createElement('button');
  button.className = 'name-form__button';
  button.type = 'submit';
  button.textContent = buttonText;

  form.append(input, button);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    try {
      await onSubmit(input.value.trim(), input);
    } finally {
      button.disabled = false;
    }
  });
  return form;
}

function renderSlot(slot) {
  const item = document.createElement('li');
  item.className = slot.booked_by ? 'slot slot_booked' : 'slot slot_free';

  const time = document.createElement('span');
  time.className = 'slot__time';
  time.textContent = slot.slot_time;

  const status = document.createElement('span');
  status.className = 'slot__status';
  status.textContent = slot.booked_by ? `Занято: ${slot.booked_by}` : 'Свободно';

  item.append(time, status);
  if (!slot.booked_by) {
    item.append(
      createNameForm({
        label: `ФИО для записи на ${slot.slot_time}`,
        buttonText: 'Записаться',
        onSubmit: (name) => bookSlot(slot.slot_time, name),
      })
    );
  }
  return item;
}

function renderSlots(data) {
  dateElement.textContent = formatDate(data.date);
  slotsElement.replaceChildren(...data.slots.map(renderSlot));
}

function renderLastFeeding(lastFeeding) {
  feedingLastElement.textContent = lastFeeding
    ? `${formatDateTime(lastFeeding.fed_at)} — ${lastFeeding.employee_name}`
    : 'Кормление ещё не отмечали.';
}

async function loadSlots() {
  try {
    const response = await fetch('/api/slots');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    renderSlots(await response.json());
  } catch {
    dateElement.textContent = 'Не удалось загрузить слоты. Обновите страницу.';
  }
}

async function loadLastFeeding() {
  try {
    const response = await fetch('/api/feedings/last');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    renderLastFeeding((await response.json()).lastFeeding);
  } catch {
    feedingLastElement.textContent = 'Не удалось загрузить кормление. Обновите страницу.';
  }
}

async function bookSlot(slotTime, name) {
  if (!name) {
    showNotice(slotsNoticeElement, 'Введите ФИО.', 'error');
    return;
  }
  try {
    const { ok, data } = await postJson('/api/bookings', { slotTime, name });
    if (data.slots) {
      renderSlots(data);
    }
    if (ok) {
      showNotice(slotsNoticeElement, `Вы записаны на ${slotTime}.`, 'success');
    } else {
      showNotice(slotsNoticeElement, data.error, 'error');
    }
  } catch {
    showNotice(slotsNoticeElement, 'Не удалось записаться. Проверьте соединение и попробуйте ещё раз.', 'error');
  }
}

async function markFeeding(name, input) {
  if (!name) {
    showNotice(feedingNoticeElement, 'Введите ФИО.', 'error');
    return;
  }
  try {
    const { ok, data } = await postJson('/api/feedings', { name });
    if (ok) {
      renderLastFeeding(data.lastFeeding);
      input.value = '';
      showNotice(feedingNoticeElement, 'Кормление отмечено.', 'success');
    } else {
      showNotice(feedingNoticeElement, data.error, 'error');
    }
  } catch {
    showNotice(feedingNoticeElement, 'Не удалось отметить кормление. Проверьте соединение и попробуйте ещё раз.', 'error');
  }
}

feedingFormElement.replaceWith(
  createNameForm({
    label: 'ФИО того, кто покормил Бориса',
    buttonText: 'Отметить кормление',
    onSubmit: markFeeding,
  })
);

loadSlots();
loadLastFeeding();
