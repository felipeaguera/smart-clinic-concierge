

# Fix: Clara responding despite active auto-pause

## Root Cause

The current code has a **single pause checkpoint** before calling the AI. If a secretary sends a manual reply while the AI is processing, the pause is created AFTER the check has already passed. The AI response is then sent to the patient despite the active pause.

```text
Timeline (race condition):

Patient msg webhook       Secretary msg webhook
    |                           |
    v                           |
 Check pause → NO               |
    |                           |
    v                           v
 Call AI (takes 3-5s)     Create auto-pause
    |                           |
    v                           v
 Send AI response ← BUG!     Return OK
```

## Solution

Add a **second pause check** right before sending the AI response via Z-API. This guarantees that even if a pause is created during AI processing, the response will be blocked.

Additionally, add a pause check before calling the AI as a redundant safety net.

## Changes to `supabase/functions/zapi-webhook/index.ts`

### 1. Add second pause check AFTER AI response, BEFORE sending

After line 583 (where `aiResponse` and `humanHandoff` are extracted) and before sending the response (line 645), add:

```typescript
// SECOND PAUSE CHECK: Verify pause wasn't created while AI was processing
const isPausedAfterAI = await shouldPauseClara(supabase, phone);
if (isPausedAfterAI) {
  console.log("PAUSE DETECTED AFTER AI PROCESSING for:", phone);
  console.log("   - AI response will NOT be sent");
  console.log("   - Secretary intervened during AI processing");
  return new Response(
    JSON.stringify({ 
      success: true, 
      claraPaused: true, 
      reason: "pause_detected_after_ai" 
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

This check covers:
- Race conditions where the secretary replies while the AI is generating a response
- Cases where a handoff was opened during AI processing

### 2. Add pause check in the handoff block too

Before sending the handoff notification message (line 587+), also check if a manual pause was created to avoid sending duplicate/conflicting messages.

## Summary of all pause checkpoints after fix

| Checkpoint | Location | Purpose |
|-----------|----------|---------|
| 1. fromMe detection | Line 325 | Creates pause + hard return for secretary messages |
| 2. Before AI call | Line 528 | Blocks processing if pause already exists |
| 3. After AI response | NEW | Catches pauses created during AI processing (race condition fix) |

## File to modify

| File | Change |
|------|--------|
| `supabase/functions/zapi-webhook/index.ts` | Add second `shouldPauseClara` check after AI response, before sending via Z-API |

## Expected behavior after fix

```text
Timeline (race condition - FIXED):

Patient msg webhook       Secretary msg webhook
    |                           |
    v                           |
 Check pause -> NO              |
    |                           |
    v                           v
 Call AI (takes 3-5s)     Create auto-pause
    |                           |
    v                           v
 Check pause -> YES!          Return OK
    |
    v
 BLOCK response (return)
```

Clara will remain completely silent during the pause period and will only resume after the pause expires (1 hour) or manual resolution.
