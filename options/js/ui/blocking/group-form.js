/**
 * Inline group creation form builder and toggle.
 */
export function toggleNewGroupForm(blockingUI) {
    const existing = document.getElementById('newGroupForm');
    if (existing) {
        existing.remove();
        return;
    }
    const list = document.getElementById('restrictedList');
    if (!list) return;
    const form = createGroupForm(blockingUI);
    list.parentNode.insertBefore(form, list);
    const nameInput = form.querySelector('.new-group-name-input');
    if (nameInput) nameInput.focus();
}

function createGroupForm(blockingUI) {
    const form = document.createElement('div');
    form.id = 'newGroupForm';
    form.className = 'new-group-form';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'modern-input new-group-name-input';
    nameInput.placeholder = 'Group name...';
    nameInput.setAttribute('autocomplete', 'off');

    const limitInput = document.createElement('input');
    limitInput.type = 'number';
    limitInput.className = 'rule-limit-input-edit';
    limitInput.value = '30';
    limitInput.min = 0;
    limitInput.title = 'Daily limit (minutes)';
    limitInput.addEventListener('keydown', (e) => {
        if (['-', '+', 'e', 'E'].includes(e.key)) {
            e.preventDefault();
        }
    });
    limitInput.addEventListener('input', () => {
        if (!limitInput.validity.valid || limitInput.value.includes('-')) {
            limitInput.value = limitInput.value.replace(/[-+eE]/g, '');
        }
    });

    const createBtn = document.createElement('button');
    createBtn.className = 'btn btn-primary btn-small';
    createBtn.textContent = 'Create';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary btn-small';
    cancelBtn.textContent = 'Cancel';

    const doCreate = () => {
        const name = nameInput.value.trim();
        const parsedLimit = parseInt(limitInput.value, 10);
        const limit = isNaN(parsedLimit) || parsedLimit < 0 ? 30 : parsedLimit;
        if (!name) {
            blockingUI.controller.showWarning('Please enter a group name');
            return;
        }
        blockingUI.createGroup(name, [], limit);
        form.remove();
    };

    createBtn.addEventListener('click', doCreate);
    cancelBtn.addEventListener('click', () => form.remove());
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doCreate();
    });

    form.appendChild(nameInput);
    form.appendChild(limitInput);
    form.appendChild(createBtn);
    form.appendChild(cancelBtn);

    return form;
}
