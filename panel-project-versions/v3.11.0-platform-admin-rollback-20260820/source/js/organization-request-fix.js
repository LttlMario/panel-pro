(() => {
  const original = window.fetch;
  window.fetch = (url, options = {}) => {
    if (String(url).includes('/functions/v1/manage-organizations')) options.headers = { ...(options.headers || {}), 'x-panel-session': localStorage.getItem('panel_session_token') || '' };
    return original(url, options);
  };
})();
