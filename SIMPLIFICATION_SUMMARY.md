# PR #10 Simplification Summary

## Key Findings

| Category | Severity | Effort | Impact |
|----------|----------|--------|--------|
| Duplicate model names | HIGH | 2 min | Remove 8 LOC |
| Duplicate sanitization | HIGH | 5 min | Remove 20 LOC |
| Unused MCPClient methods | MEDIUM | 2 min | Simplify API |
| Complex tool selection | MEDIUM | 10 min | Remove 25 LOC |
| Fragmented MCP state | MEDIUM | 20 min | Remove 30+ LOC |
| Over-engineered streaming | MEDIUM | 20 min | Improve clarity |
| Unused interface | LOW | 1 min | Remove 2 LOC |
| Redundant event cleanup | LOW | 5 min | Remove 20 LOC |

---

## Quick Wins (5 minutes total)

### 1. Merge Identical Model Objects
**File**: `src/renderer/main.ts:246-253`
```diff
- const modelDisplayNames = { ... };
- const modelShortNames = { ... };  // IDENTICAL
+ const modelNames = { ... };
```
**Saves**: 8 LOC

### 2. Delete Unused Interface
**File**: `src/renderer/main.ts:122`
```diff
- interface UploadedAttachmentPayload extends AttachmentPayload {}
```
Replace all uses with `AttachmentPayload`
**Saves**: 2 LOC

### 3. Remove Unused MCPClient Methods
**File**: `src/mcp/client.ts:175-199`
```diff
- getConnection(serverId: string): MCPConnection | undefined
- getAllConnections(): MCPConnection[]
- getAllTools(): Array<...>
```
**Saves**: 25 LOC, simplifies API

---

## Medium Effort (20 minutes)

### 4. Extract Shared Sanitization
**Create**: `src/utils/sanitize.ts`
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
**Import in**: `main.ts` and `mcp/client.ts`
**Saves**: 20 LOC of duplication

### 5. Simplify Tool Badge Count
**File**: `src/renderer/main.ts:2064-2093`
```diff
  function updateToolsBadge() {
    const badge = $('tools-badge');
    if (!badge) return;
-   let count = 0;
-   for (const serverId of selectedMCPServers) { ... }
-   for (const toolKey of selectedMCPTools) { ... }
+   const count = getSelectedMCPTools().length;
    badge.textContent = count.toString();
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
```
**Saves**: 25 LOC, reuses existing logic

### 6. Consolidate Listener Cleanup
**File**: `src/preload.ts:66-106`
```diff
- removeStreamListeners: () => { ... }
- removeSpotlightListeners: () => { ... }
+ removeAllListeners: (prefix: string) => { ... }
```
**Saves**: 20 LOC

---

## Complex Refactor (30+ minutes, requires testing)

### 7. Flatten Streaming Blocks
**File**: `src/renderer/main.ts:255-267 + ~60 call sites`

**Current**:
```typescript
const streamingBlocks = {
  thinkingBlocks: new Map(),
  toolBlocks: new Map(),
  textBlocks: new Map(),
  textContent: ''
};

// Called 60+ times: streamingBlocks.X
```

**Proposed**:
```typescript
let thinkingBlocks = new Map();
let toolBlocks = new Map();
let textBlocks = new Map();
let textContent = '';

// Called 60+ times: just X
```

**Impact**:
- Clearer variable names
- No property lookup overhead
- Easier to trace variable lifecycle
- Requires updating 60+ call sites

---

## State Consolidation (Moderate complexity)

### 8. Unify MCP Tool Selection State
**File**: `src/renderer/main.ts:231-235, 2255-2275`

**Current** (3 separate data structures):
```typescript
let mcpServerStatus: MCPServerStatus[] = [];
let selectedMCPTools: Set<string> = new Set();      // "serverId:toolName"
let selectedMCPServers: Set<string> = new Set();     // serverIds only
let toolsPopupExpanded: Set<string> = new Set();
```

**Proposed** (unified):
```typescript
let mcpState = {
  servers: [] as MCPServerStatus[],
  selectedTools: new Map<string, Set<string>>(), // serverId -> Set<toolName>
  expandedServers: new Set<string>()
};
```

**Benefit**: Eliminates complex merge logic in `getSelectedMCPTools()`

---

## Summary Table

| Task | LOC Saved | Time | Risk | Status |
|------|-----------|------|------|--------|
| Merge models | 8 | 2m | LOW | Ready |
| Delete interface | 2 | 1m | LOW | Ready |
| Remove methods | 25 | 2m | LOW | Ready |
| Sanitize utility | 20 | 5m | LOW | Ready |
| Tool badge | 25 | 10m | LOW | Ready |
| Listeners | 20 | 5m | LOW | Ready |
| Streaming blocks | 40 | 20m | MEDIUM | Requires testing |
| State unify | 30 | 15m | MEDIUM | Requires testing |
| **TOTAL** | **170** | **60m** | — | — |

---

## Risk Assessment

### HIGH CONFIDENCE (Low Risk)
- Merge duplicate objects
- Extract shared utilities
- Remove unused methods
- Delete unused types

### MEDIUM CONFIDENCE (Needs Testing)
- Flatten nested objects (60+ call sites)
- Unify state management (affects multiple functions)

### Testing Needed For:
- Streaming blocks refactor: Load conversation, verify thinking/tools/text render correctly
- State unification: Test tool selection UI, badge updates, getSelectedMCPTools output

---

## Recommendation

**Phase 1 (Immediate - 20 LOC saved, 10 minutes)**:
1. Merge model name objects
2. Extract sanitization utility
3. Remove unused MCPClient methods
4. Delete UploadedAttachmentPayload interface

**Phase 2 (If Refactoring - 70 LOC saved, 30 minutes)**:
5. Simplify tool badge update
6. Consolidate listener cleanup
7. Flatten streaming blocks (with testing)
8. Unify MCP state (with testing)

**Cumulative Impact**:
- Reduce PR changes by 170 LOC (6% reduction)
- Improve code clarity
- Eliminate duplication
- Simplify public APIs
