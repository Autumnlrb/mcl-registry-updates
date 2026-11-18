const filter = document.querySelector('#filter');
if (filter) {
    const studies = [...document.querySelectorAll('[data-study]')];
    const monitored = document.querySelector('.monitored');
    filter.closest('.search').hidden = false;
    filter.addEventListener('input', () => {
        const query = filter.value.trim().toLocaleLowerCase();
        const terms = query.split(/\s+/);
        if (query && monitored) monitored.open = true;
        let matches = 0;
        for (const card of studies) {
            const key = card.dataset.study.toLocaleLowerCase();
            card.hidden = !terms.every(term => key.includes(term));
            if (!card.hidden) matches++;
        }
        document.querySelector('#empty').hidden = matches > 0;
    });
}

for (const button of document.querySelectorAll('[data-copy]')) {
    button.hidden = false;
    button.addEventListener('click', async () => {
        const panel = button.closest('details');
        const text = panel.querySelector('textarea');
        const status = panel.querySelector('[role=status]');
        try {
            await navigator.clipboard.writeText(text.value);
            status.textContent = '已复制';
        } catch {
            text.focus();
            text.select();
            status.textContent = '文本已选中，可使用设备的复制功能。';
        }
    });
}
