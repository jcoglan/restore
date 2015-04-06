RemoteStorage.defineModule('vault', function(client) {
  return {name: 'vault', exports: client};
});

remoteStorage.access.claim('vault', 'rw');
remoteStorage.displayWidget();

remoteStorage.vault.storeFile('text/html', 'deep/bar', '<p>Hello</p>');

document.getElementById('clear-button').addEventListener('click', function() {
  localStorage.clear();
  location.href = location.origin + location.pathname + location.search;
});
