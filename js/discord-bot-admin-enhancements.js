(() => {
  const modules = document.getElementById('modules');
  const saveButton = document.getElementById('save');
  const globalStatus = document.getElementById('status');
  if (!modules || !saveButton || !globalStatus) return;

  saveButton.textContent = 'Salvează și publică toate embedurile';
  const originalSave = saveButton.onclick;
  saveButton.onclick = async (event) => {
    saveButton.disabled = true;
    globalStatus.textContent = 'Se salvează canalele…';
    await originalSave?.call(saveButton, event);
    if (!/au fost salvate/i.test(globalStatus.textContent || '')) {
      saveButton.disabled = false;
      return;
    }

    const publishButtons = [...modules.querySelectorAll('[data-publish]:not(:disabled)')];
    globalStatus.textContent = publishButtons.length
      ? `Se publică ${publishButtons.length} embeduri…`
      : 'Canalele au fost salvate. Nu există module active de publicat.';
    for (const button of publishButtons) {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    globalStatus.textContent = publishButtons.length
      ? `Canalele au fost salvate și ${publishButtons.length} embeduri au fost publicate.`
      : 'Canalele au fost salvate. Nu există module active de publicat.';
    saveButton.disabled = false;
  };
})();
