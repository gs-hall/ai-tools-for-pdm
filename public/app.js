const dateElement = document.getElementById('walk-date');
const slotsElement = document.getElementById('slots');

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
  return item;
}

async function loadSlots() {
  try {
    const response = await fetch('/api/slots');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    dateElement.textContent = formatDate(data.date);
    slotsElement.replaceChildren(...data.slots.map(renderSlot));
  } catch {
    dateElement.textContent = 'Не удалось загрузить слоты. Обновите страницу.';
  }
}

loadSlots();
