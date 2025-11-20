# Note HUD Resize Implementation

## Summary
Added custom resize handles to the Note HUD window, allowing users to click-drag the edges and corners to resize the window.

## Changes Made

### 1. Frontend (Renderer) - `src/renderer/noteHud/index.tsx`
- Added `isResizing` state to track when user is actively resizing
- Implemented `handleResizeStart` function that:
  - Captures initial mouse position and window dimensions
  - Adds mousemove and mouseup event listeners
  - Calculates new dimensions based on mouse movement
  - Calls the resize IPC method with new dimensions and edge info
  - Enforces minimum width (180px) and height (120px)
- Added 8 resize handles to the DOM:
  - 4 edge handles (top, right, bottom, left)
  - 4 corner handles (top-left, top-right, bottom-left, bottom-right)
- Added `resizing` class to shell during resize for better UX

### 2. Styles - `src/renderer/noteHud/style.css`
- Added `.resize-handle` base styles with proper positioning and z-index
- Positioned edge handles along each side (8px width/height)
- Positioned corner handles at each corner (16x16px)
- Added appropriate cursors for each handle type:
  - `ns-resize` for top/bottom edges
  - `ew-resize` for left/right edges
  - `nwse-resize` for top-left/bottom-right corners
  - `nesw-resize` for top-right/bottom-left corners
- Added hover effect with subtle highlight color
- Disabled text selection during resize with `.resizing` class
- Set `-webkit-app-region: no-drag` to prevent drag region conflicts

### 3. Preload Bridge - `src/preload/preload.ts`
- Added `resize(width, height, edge)` method to `noteHud` API object
- Exposes IPC call to renderer for window resizing

### 4. IPC Handler - `src/main/noteHudIpc.ts`
- Imported `resizeNoteHud` function from noteHudWindow
- Registered `noteHud:resize` IPC handler
- Validates and forwards resize requests to main process

### 5. Main Process - `src/main/noteHudWindow.ts`
- Implemented `resizeNoteHud(width, height, edge)` function
- Handles edge-specific resize logic:
  - Right/Bottom edges: Only changes width/height
  - Left/Top edges: Adjusts position AND dimensions to maintain opposite edge position
  - Corner resizing: Combines appropriate edge behaviors
- Uses `setBounds()` to apply window changes smoothly
- Respects existing minWidth/minHeight constraints

## How It Works

1. User hovers over window edge/corner → Cursor changes to resize icon
2. User clicks and drags → `handleResizeStart` is triggered
3. During drag:
   - Mouse movement is tracked
   - New dimensions are calculated based on drag direction
   - Dimensions are constrained to minimum values
   - IPC call sends new dimensions to main process
4. Main process:
   - Receives resize request
   - Adjusts window bounds appropriately for the edge being dragged
   - Updates window immediately for smooth resize
5. User releases mouse → Event listeners are cleaned up

## Technical Notes

- The resize is handled via IPC rather than pure CSS because this is an Electron frameless window
- Position adjustment for left/top edges ensures the opposite edge stays fixed during resize
- Minimum dimensions match those defined in the BrowserWindow options (180x120)
- The `thickFrame: true` option enables native window shadows but doesn't provide native resize handles for transparent windows
- Custom handles overlay the window content with high z-index (1000)

## Testing
After rebuilding/restarting the app, you should be able to:
- Click and drag any edge to resize in that direction
- Click and drag corners to resize both dimensions simultaneously
- See the cursor change when hovering over resize areas
- See a subtle highlight on hover
- Experience smooth, immediate resizing
