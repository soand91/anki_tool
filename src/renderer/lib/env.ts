export const isElectron = 
  navigator.userAgent.toLowerCase().includes('electron') || !!(window.process?.versions?.electron);