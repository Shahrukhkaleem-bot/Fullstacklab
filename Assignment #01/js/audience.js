// "Share with" control used when posting news: all friends, or only the friends ticked in the list.
// Usage: const picker = AudiencePicker(containerElement, 'prefix'); picker.value() -> { audience, sharedWith }

function AudiencePicker(container, prefix) {
  const friends = Store.friendsOf(Store.me().username);

  container.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <label class="small text-muted text-nowrap" for="${prefix}-aud"><i class="bi bi-eye"></i> Visible to</label>
      <select class="form-select form-select-sm w-auto border-0 bg-body-tertiary" id="${prefix}-aud">
        <option value="all">All friends</option>
        <option value="some">Selected friends</option>
      </select>
    </div>
    <div class="bg-body-tertiary rounded-3 p-2 mt-2 d-none" id="${prefix}-list">
      <div class="small text-muted mb-1">Choose who can see it:</div>
      ${friends.length ? friends.map((f) => `
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="checkbox" id="${prefix}-f-${UI.esc(f.username)}" value="${UI.esc(f.username)}">
          <label class="form-check-label small" for="${prefix}-f-${UI.esc(f.username)}">${UI.esc(f.name)}</label>
        </div>`).join('') : '<span class="small text-muted">You have no friends yet.</span>'}
    </div>`;

  const select = container.querySelector(`#${prefix}-aud`);
  const list = container.querySelector(`#${prefix}-list`);
  const boxes = () => [...list.querySelectorAll('input[type="checkbox"]')];

  select.addEventListener('change', () => list.classList.toggle('d-none', select.value !== 'some'));

  return {
    value() {
      return { audience: select.value, sharedWith: boxes().filter((b) => b.checked).map((b) => b.value) };
    },
    reset() {
      select.value = 'all';
      boxes().forEach((b) => (b.checked = false));
      list.classList.add('d-none');
    }
  };
}
