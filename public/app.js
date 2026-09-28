const dateElement = document.getElementById('walk-date');
const slotsElement = document.getElementById('slots');
const noticeElement = document.getElementById('notice');

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function showNotice(text, type) {
  noticeElement.textContent = text;
  noticeElement.className = `notice notice_${type}`;
  noticeElement.hidden = false;
}

function hideNotice() {
  noticeElement.hidden = true;
}

function createBookingForm(slotTime) {
  const form = document.createElement('form');
  form.className = 'booking';

  const input = document.createElement('input');
  input.className = 'booking__input';
  input.name = 'name';
  input.type = 'text';
  input.required = true;
  input.maxLength = 100;
  input.placeholder = 'ФИО';
  input.setAttribute('aria-label', `ФИО для записи на ${slotTime}`);

  const button = document.createElement('button');
  button.className = 'booking__button';
  button.type = 'submit';
  button.textContent = 'Записаться';

  form.append(input, button);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    bookSlot(slotTime, input.value, button);
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
    item.append(createBookingForm(slot.slot_time));
  }
  return item;
}

function render(data) {
  dateElement.textContent = formatDate(data.date);
  slotsElement.replaceChildren(...data.slots.map(renderSlot));
}

async function loadSlots() {
  try {
    const response = await fetch('/api/slots');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    render(await response.json());
  } catch {
    dateElement.textContent = 'Не удалось загрузить слоты. Обновите страницу.';
  }
}

async function bookSlot(slotTime, name, button) {
  if (!name.trim()) {
    showNotice('Введите ФИО.', 'error');
    return;
  }

  button.disabled = true;
  hideNotice();
  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotTime, name }),
    });
    const data = await response.json();

    if (response.ok) {
      render(data);
      showNotice(`Вы записаны на ${slotTime}.`, 'success');
      return;
    }
    if (data.slots) {
      render(data);
    }
    showNotice(data.error, 'error');
  } catch {
    showNotice('Не удалось записаться. Проверьте соединение и попробуйте ещё раз.', 'error');
  } finally {
    button.disabled = false;
  }
}

loadSlots();
