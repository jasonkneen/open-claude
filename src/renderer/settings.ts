// Settings renderer

const claude = (window as any).claude;

interface Settings {
  spotlightKeybind: string;
  spotlightPersistHistory: boolean;
}

// DOM Elements
const keybindInput = document.getElementById('keybind-input') as HTMLElement;
const keybindDisplay = document.getElementById('keybind-display') as HTMLElement;
const persistHistoryCheckbox = document.getElementById('persist-history') as HTMLInputElement;

let isRecordingKeybind = false;
let currentSettings: Settings | null = null;
let pendingKeybind: string | null = null;

// Detect if we're on macOS
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

// Format keybind for display
function formatKeybind(keybind: string): string {
  return keybind
    .replace('CommandOrControl', isMac ? '\u2318' : 'Ctrl')
    .replace('Command', '\u2318')
    .replace('Control', 'Ctrl')
    .replace('Shift', '\u21E7')
    .replace('Alt', '\u2325')
    .replace('Option', '\u2325')
    .replace(/\+/g, ' + ');
}

// Build accelerator string from current modifier state
function buildAcceleratorFromModifiers(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.metaKey || e.ctrlKey) {
    parts.push('CommandOrControl');
  }
  if (e.shiftKey) {
    parts.push('Shift');
  }
  if (e.altKey) {
    parts.push('Alt');
  }

  return parts.join('+');
}

// Convert key event to Electron accelerator format
function keyEventToAccelerator(e: KeyboardEvent): { accelerator: string; isComplete: boolean } {
  const parts: string[] = [];

  if (e.metaKey || e.ctrlKey) {
    parts.push('CommandOrControl');
  }
  if (e.shiftKey) {
    parts.push('Shift');
  }
  if (e.altKey) {
    parts.push('Alt');
  }

  // Get the key
  let key = e.key;

  // Check if this is a modifier-only press
  const isModifierOnly = ['Meta', 'Control', 'Shift', 'Alt'].includes(key);

  if (!isModifierOnly) {
    // Normalize key names
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();

    // Map special keys
    const keyMap: Record<string, string> = {
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'Escape': 'Escape',
      'Enter': 'Return',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'Tab': 'Tab',
    };

    if (keyMap[key]) {
      key = keyMap[key];
    }

    parts.push(key);
  }

  return {
    accelerator: parts.join('+'),
    isComplete: !isModifierOnly && parts.length >= 2 // Need at least one modifier + one key
  };
}

// Load settings
async function loadSettings() {
  currentSettings = await claude.getSettings();

  if (currentSettings) {
    keybindDisplay.textContent = formatKeybind(currentSettings.spotlightKeybind);
    persistHistoryCheckbox.checked = currentSettings.spotlightPersistHistory;
  }
}

// Save keybind
async function saveKeybind(keybind: string) {
  if (!currentSettings) return;

  currentSettings = await claude.saveSettings({ spotlightKeybind: keybind });
  keybindDisplay.textContent = formatKeybind(keybind);
}

// Save persist history
async function savePersistHistory(value: boolean) {
  if (!currentSettings) return;

  currentSettings = await claude.saveSettings({ spotlightPersistHistory: value });
}

// Stop recording and save if we have a valid keybind
function stopRecording(save: boolean) {
  if (!isRecordingKeybind) return;

  isRecordingKeybind = false;
  keybindInput.classList.remove('recording');

  if (save && pendingKeybind) {
    saveKeybind(pendingKeybind);
  } else if (currentSettings) {
    keybindDisplay.textContent = formatKeybind(currentSettings.spotlightKeybind);
  }

  pendingKeybind = null;
}

// Keybind recording
keybindInput.addEventListener('click', () => {
  if (!isRecordingKeybind) {
    isRecordingKeybind = true;
    pendingKeybind = null;
    keybindInput.classList.add('recording');
    keybindDisplay.textContent = 'Press keys...';
    keybindInput.focus();
  }
});

keybindInput.addEventListener('keydown', (e) => {
  if (!isRecordingKeybind) return;

  e.preventDefault();
  e.stopPropagation();

  // Handle Escape to cancel
  if (e.key === 'Escape') {
    stopRecording(false);
    return;
  }

  // Handle Enter to confirm
  if (e.key === 'Enter' && pendingKeybind) {
    stopRecording(true);
    return;
  }

  const result = keyEventToAccelerator(e);

  // Update display to show current keys being pressed
  if (result.accelerator) {
    keybindDisplay.textContent = formatKeybind(result.accelerator);

    // If we have a complete combo (modifier + key), store it as pending
    if (result.isComplete) {
      pendingKeybind = result.accelerator;
    }
  }
});

keybindInput.addEventListener('blur', () => {
  // Save pending keybind on blur (clicking away)
  stopRecording(!!pendingKeybind);
});

// Persist history toggle
persistHistoryCheckbox.addEventListener('change', () => {
  savePersistHistory(persistHistoryCheckbox.checked);
});

// MCP Server management
interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

let mcpServers: MCPServer[] = [];
let editingServerId: string | null = null;

const serversList = document.getElementById('mcp-servers-list') as HTMLElement;
const addServerBtn = document.getElementById('add-mcp-server-btn') as HTMLElement;
const modal = document.getElementById('add-server-modal') as HTMLElement;
const modalTitle = document.getElementById('modal-title') as HTMLElement;
const closeModalBtn = document.getElementById('close-modal-btn') as HTMLElement;
const cancelModalBtn = document.getElementById('cancel-modal-btn') as HTMLElement;
const saveServerBtn = document.getElementById('save-server-btn') as HTMLElement;
const serverNameInput = document.getElementById('server-name') as HTMLInputElement;
const serverCommandInput = document.getElementById('server-command') as HTMLInputElement;
const serverArgsInput = document.getElementById('server-args') as HTMLInputElement;

async function loadMCPServers() {
  mcpServers = await claude.getMCPServers() || [];
  renderServersList();
}

function renderServersList() {
  if (!serversList) return;

  if (mcpServers.length === 0) {
    serversList.innerHTML = '<p style="text-align: center; color: rgba(128, 128, 128, 0.7); font-size: 13px; padding: 12px;">No MCP servers configured</p>';
    return;
  }

  serversList.innerHTML = mcpServers.map(server => `
    <div class="mcp-server-item" data-id="${server.id}">
      <label class="toggle" style="margin-right: 4px;">
        <input type="checkbox" ${server.enabled ? 'checked' : ''} data-action="toggle" data-id="${server.id}">
        <span class="toggle-slider"></span>
      </label>
      <div class="mcp-server-info">
        <div class="mcp-server-name">${escapeHtml(server.name)}</div>
        <div class="mcp-server-command">${escapeHtml(server.command)} ${escapeHtml(server.args.join(' '))}</div>
      </div>
      <div class="mcp-server-actions">
        <button class="mcp-server-btn" data-action="edit" data-id="${server.id}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="mcp-server-btn delete" data-action="delete" data-id="${server.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showModal(isEdit = false) {
  if (modal) {
    modal.style.display = 'flex';
    if (modalTitle) {
      modalTitle.textContent = isEdit ? 'Edit MCP Server' : 'Add MCP Server';
    }
  }
}

function hideModal() {
  if (modal) {
    modal.style.display = 'none';
  }
  editingServerId = null;
  if (serverNameInput) serverNameInput.value = '';
  if (serverCommandInput) serverCommandInput.value = '';
  if (serverArgsInput) serverArgsInput.value = '';
}

async function saveServer() {
  const name = serverNameInput?.value.trim();
  const command = serverCommandInput?.value.trim();
  const argsStr = serverArgsInput?.value.trim();

  if (!name || !command) {
    return;
  }

  const args = argsStr ? argsStr.split(',').map(a => a.trim()).filter(Boolean) : [];

  if (editingServerId) {
    await claude.updateMCPServer(editingServerId, { name, command, args });
  } else {
    await claude.addMCPServer({ name, command, args, enabled: true });
  }

  await loadMCPServers();
  hideModal();
}

async function deleteServer(serverId: string) {
  await claude.removeMCPServer(serverId);
  await loadMCPServers();
}

async function toggleServer(serverId: string) {
  await claude.toggleMCPServer(serverId);
  await loadMCPServers();
}

function editServer(serverId: string) {
  const server = mcpServers.find(s => s.id === serverId);
  if (!server) return;

  editingServerId = serverId;
  if (serverNameInput) serverNameInput.value = server.name;
  if (serverCommandInput) serverCommandInput.value = server.command;
  if (serverArgsInput) serverArgsInput.value = server.args.join(', ');
  showModal(true);
}

// Event listeners for MCP servers
addServerBtn?.addEventListener('click', () => showModal());
closeModalBtn?.addEventListener('click', hideModal);
cancelModalBtn?.addEventListener('click', hideModal);
saveServerBtn?.addEventListener('click', saveServer);

modal?.addEventListener('click', (e) => {
  if (e.target === modal) hideModal();
});

serversList?.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest('[data-action]') as HTMLElement;
  if (!btn) return;

  const action = btn.dataset.action;
  const serverId = btn.dataset.id;
  if (!serverId) return;

  if (action === 'delete') deleteServer(serverId);
  else if (action === 'edit') editServer(serverId);
});

serversList?.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  if (target.dataset.action === 'toggle' && target.dataset.id) {
    toggleServer(target.dataset.id);
  }
});

// Load settings on page load
window.addEventListener('load', () => {
  loadSettings();
  loadMCPServers();
});
