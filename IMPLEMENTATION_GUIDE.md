# Implementation Guide: PR #10 Simplifications

## Phase 1: Quick Wins (20 minutes)

### 1. Create Shared Sanitization Utility

**Create file**: `src/utils/sanitize.ts`

```typescript
export function sanitizeArg(arg: string): string {
  if (typeof arg !== 'string') return '';
  if ((arg.startsWith('"') && arg.endsWith('"')) ||
      (arg.startsWith("'") && arg.endsWith("'"))) {
    return arg.slice(1, -1);
  }
  return arg;
}

export function sanitizeArgs(args: string[]): string[] {
  return args.map(sanitizeArg);
}
```

**Update**: `src/main.ts`

```typescript
// DELETE lines 93-102 (the old sanitizeArg function)
// ADD import at top
import { sanitizeArg, sanitizeArgs } from './utils/sanitize';

// Now main.ts uses the shared utility
```

**Update**: `src/mcp/client.ts`

```typescript
// DELETE lines 27-35 (the old sanitizeArgs function)
// ADD import at top
import { sanitizeArg, sanitizeArgs } from '../utils/sanitize';

// Now mcp/client.ts uses the shared utility
```

**Lines Saved**: 20 | **Effort**: 5 minutes | **Testing**: None needed

---

### 2. Merge Identical Model Name Objects

**File**: `src/renderer/main.ts` (lines 237-253)

**BEFORE**:
```typescript
const modelDisplayNames: Record<string, string> = {
  'claude-opus-4-5-20251101': 'Opus 4.5',
  'claude-sonnet-4-20250514': 'Sonnet 4',
  'claude-opus-4-20250514': 'Opus 4',
  'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-3-5-haiku-20241022': 'Haiku 3.5'
};

const modelShortNames: Record<string, string> = {
  'claude-opus-4-5-20251101': 'Opus 4.5',
  'claude-sonnet-4-20250514': 'Sonnet 4',
  'claude-opus-4-20250514': 'Opus 4',
  'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-3-5-haiku-20241022': 'Haiku 3.5'
};
```

**AFTER**:
```typescript
const modelNames: Record<string, string> = {
  'claude-opus-4-5-20251101': 'Opus 4.5',
  'claude-sonnet-4-20250514': 'Sonnet 4',
  'claude-opus-4-20250514': 'Opus 4',
  'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-3-5-haiku-20241022': 'Haiku 3.5'
};
```

**Find and Replace**:
- `modelDisplayNames[` -> `modelNames[`
- `modelShortNames[` -> `modelNames[`

**Lines Saved**: 8 | **Effort**: 2 minutes | **Testing**: None

---

### 3. Delete Unused Interface

**File**: `src/renderer/main.ts` (line 122)

**DELETE**:
```typescript
interface UploadedAttachmentPayload extends AttachmentPayload {}
```

**Find and Replace**:
- `UploadedAttachmentPayload` -> `AttachmentPayload`

Should find 2-3 occurrences in the file.

**Lines Saved**: 2 | **Effort**: 1 minute | **Testing**: Type checking only

---

### 4. Remove Unused MCPClient Methods

**File**: `src/mcp/client.ts` (lines 175-199)

**DELETE** these three methods entirely:
```typescript
  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId);
  }

  getAllConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  getAllTools(): Array<{ serverId: string; serverName: string; tool: MCPTool }> {
    const allTools: Array<{ serverId: string; serverName: string; tool: MCPTool }> = [];

    for (const [serverId, connection] of this.connections) {
      if (!connection.isConnected) continue;

      for (const tool of connection.tools) {
        allTools.push({
          serverId,
          serverName: connection.config.name,
          tool
        });
      }
    }

    return allTools;
  }
```

**Why**: These are never called from outside the class. The functionality is only used internally by `getToolsForClaude()`.

**Lines Saved**: 25 | **Effort**: 2 minutes | **Testing**: Search codebase to confirm unused

---

## Phase 2: Medium Effort Refactors (30 minutes)

### 5. Simplify Tool Badge Update

**File**: `src/renderer/main.ts` (lines 2064-2093)

**BEFORE**:
```typescript
function updateToolsBadge() {
  const badge = $('tools-badge');
  if (!badge) return;

  // Count total selected tools
  let count = 0;

  // Count tools from selected servers
  for (const serverId of selectedMCPServers) {
    const server = mcpServerStatus.find(s => s.id === serverId);
    if (server && server.isConnected) {
      count += server.tools.length;
    }
  }

  // Add individually selected tools (not from selected servers)
  for (const toolKey of selectedMCPTools) {
    const [serverId] = toolKey.split(':');
    if (!selectedMCPServers.has(serverId)) {
      count++;
    }
  }

  if (count > 0) {
    badge.textContent = count.toString();
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}
```

**AFTER**:
```typescript
function updateToolsBadge() {
  const badge = $('tools-badge');
  if (!badge) return;

  const count = getSelectedMCPTools().length;
  badge.textContent = count.toString();
  badge.style.display = count > 0 ? 'flex' : 'none';
}
```

**Why**: `getSelectedMCPTools()` already calculates this. No need to duplicate the logic.

**Lines Saved**: 25 | **Effort**: 5 minutes | **Testing**: Verify badge updates correctly

---

### 6. Consolidate Event Listener Cleanup (Preload)

**File**: `src/preload.ts` (lines 66-76, 99-106)

**BEFORE**:
```typescript
removeStreamListeners: () => {
  ipcRenderer.removeAllListeners('message-stream');
  ipcRenderer.removeAllListeners('message-complete');
  ipcRenderer.removeAllListeners('message-thinking');
  ipcRenderer.removeAllListeners('message-thinking-stream');
  ipcRenderer.removeAllListeners('message-tool-use');
  ipcRenderer.removeAllListeners('message-tool-result');
  ipcRenderer.removeAllListeners('message-citation');
  ipcRenderer.removeAllListeners('message-tool-approval');
  ipcRenderer.removeAllListeners('message-compaction');
},

// ... lots of other code ...

removeSpotlightListeners: () => {
  ipcRenderer.removeAllListeners('spotlight-stream');
  ipcRenderer.removeAllListeners('spotlight-complete');
  ipcRenderer.removeAllListeners('spotlight-thinking');
  ipcRenderer.removeAllListeners('spotlight-thinking-stream');
  ipcRenderer.removeAllListeners('spotlight-tool');
  ipcRenderer.removeAllListeners('spotlight-tool-result');
},
```

**AFTER**:
```typescript
private cleanupListeners(eventNames: string[]): () => void {
  return () => {
    eventNames.forEach(name => ipcRenderer.removeAllListeners(name));
  };
},

removeStreamListeners: function() {
  this.cleanupListeners([
    'message-stream',
    'message-complete',
    'message-thinking',
    'message-thinking-stream',
    'message-tool-use',
    'message-tool-result',
    'message-citation',
    'message-tool-approval',
    'message-compaction'
  ])();
},

removeSpotlightListeners: function() {
  this.cleanupListeners([
    'spotlight-stream',
    'spotlight-complete',
    'spotlight-thinking',
    'spotlight-thinking-stream',
    'spotlight-tool',
    'spotlight-tool-result'
  ])();
},
```

**Alternative (Simpler)**:
```typescript
removeStreamListeners: () => {
  ['message-stream', 'message-complete', 'message-thinking', 'message-thinking-stream',
   'message-tool-use', 'message-tool-result', 'message-citation', 'message-tool-approval',
   'message-compaction'].forEach(e => ipcRenderer.removeAllListeners(e));
},
removeSpotlightListeners: () => {
  ['spotlight-stream', 'spotlight-complete', 'spotlight-thinking', 'spotlight-thinking-stream',
   'spotlight-tool', 'spotlight-tool-result'].forEach(e => ipcRenderer.removeAllListeners(e));
},
```

**Lines Saved**: 20 | **Effort**: 5 minutes | **Testing**: Verify cleanup works

---

## Phase 3: Complex Refactors (Requires Testing)

### 7. Flatten Streaming Blocks Object

**File**: `src/renderer/main.ts` (lines 255-260 and ~60 call sites)

This is more complex. Here's the step-by-step:

**Step 1**: Replace object definition (lines 255-260)

**BEFORE**:
```typescript
const streamingBlocks = {
  thinkingBlocks: new Map<number, StreamingBlock>(),
  toolBlocks: new Map<number, StreamingBlock>(),
  textBlocks: new Map<number, StreamingBlock>(),
  textContent: ''
};

function resetStreamingBlocks() {
  streamingBlocks.thinkingBlocks.clear();
  streamingBlocks.toolBlocks.clear();
  streamingBlocks.textBlocks.clear();
  streamingBlocks.textContent = '';
}
```

**AFTER**:
```typescript
let thinkingBlocks = new Map<number, StreamingBlock>();
let toolBlocks = new Map<number, StreamingBlock>();
let textBlocks = new Map<number, StreamingBlock>();
let textContent = '';

function resetStreamingBlocks() {
  thinkingBlocks = new Map();
  toolBlocks = new Map();
  textBlocks = new Map();
  textContent = '';
}
```

**Step 2**: Find and replace all call sites

Use a find-and-replace pattern:
- `streamingBlocks\.thinkingBlocks` -> `thinkingBlocks`
- `streamingBlocks\.toolBlocks` -> `toolBlocks`
- `streamingBlocks\.textBlocks` -> `textBlocks`
- `streamingBlocks\.textContent` -> `textContent`

**Step 3**: Testing

Load a conversation and verify:
1. Thinking blocks display correctly
2. Tool use blocks display correctly
3. Text content displays correctly
4. Reset works (new conversation clears blocks)

**Lines Saved**: 40 | **Effort**: 20 minutes | **Testing**: REQUIRED - multiple scenarios

---

## Testing Checklist

After implementing Phase 1:
- [ ] Type checking passes: `npm run typecheck`
- [ ] No build errors: `npm run build`
- [ ] Code still compiles

After implementing Phase 2:
- [ ] Tool badge updates correctly when selecting/deselecting tools
- [ ] Listener cleanup actually works (no memory leaks)

After implementing Phase 3:
- [ ] Load a conversation with thinking
- [ ] Load a conversation with tool use
- [ ] Load a conversation with text
- [ ] Verify all three render correctly
- [ ] Create new conversation and verify blocks reset

---

## Commit Strategy

**Option 1: Separate commits per change**
```
1. Extract sanitization utility
2. Merge model name objects
3. Delete unused interface
4. Remove unused MCPClient methods
5. Simplify tool badge update
6. Consolidate listener cleanup
7. Flatten streaming blocks
```

**Option 2: Logical grouping**
```
1. Code cleanup (sanitization + models + interface)
2. MCPClient API simplification
3. UI logic simplification (badge + listeners)
4. Structural refactoring (streaming blocks)
```

**Recommendation**: Option 1 for easier review and rollback capability.

---

## Estimated Effort

| Phase | Changes | Time | Risk | Benefit |
|-------|---------|------|------|---------|
| Phase 1 | 4 changes | 10 min | LOW | 35 LOC saved |
| Phase 2 | 2 changes | 15 min | LOW | 45 LOC saved |
| Phase 3 | 1 change | 20 min | MEDIUM | 40 LOC saved |
| **TOTAL** | **7 changes** | **45 min** | — | **120 LOC saved** |

**Time to First Working State**: 10 minutes (Phase 1 only)
**Time to Full Implementation**: 45 minutes (all phases, including testing)
