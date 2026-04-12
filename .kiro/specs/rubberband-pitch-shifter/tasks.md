# Implementation Plan: Rubber Band Pitch Shifter

## Overview

Replace the FFmpeg `asetrate + aresample` pitch-shifting pipeline with the Rubber Band Library via `rubberband-wasm`. The implementation touches five files: the worker, the client, the PitchShifter class, the ProcessingSlice, the EditorStore, and the InspectorPanel.

## Tasks

- [x] 1. Install `rubberband-wasm` and update `PitchShiftRequest` message type
  - Run `npm install rubberband-wasm` to add the dependency
  - In `lib/workers/pitchShift.worker.ts`, add `engine: 'rubberband' | 'standard'` to the `PitchShiftRequest` type
  - _Requirements: 1.1, 6.1_

- [x] 2. Update `PitchShiftClient` to forward the `engine` field
  - [x] 2.1 Add `engine` parameter to `PitchShiftClient.pitchShift()` (default `'rubberband'`) and include it in the `PitchShiftRequest`
    - Signature: `pitchShift(channels, sampleRate, semitones, engine?: 'rubberband' | 'standard', options?)`
    - _Requirements: 6.2_

  - [ ]* 2.2 Write property test for engine field forwarding (Property 2)
    - **Property 2: Engine Field Forwarding**
    - Spy on `Worker.prototype.postMessage`, call `pitchShiftClient.pitchShift()` with each engine value, assert `capturedRequest.engine === engine`
    - **Validates: Requirements 6.2, 7.2, 11.1**

  - [ ]* 2.3 Write property test for default engine (Property 3)
    - **Property 3: Default Engine is Rubber Band**
    - Call `PitchShiftClient.pitchShift()` without an explicit engine, assert forwarded `engine === 'rubberband'`
    - **Validates: Requirements 7.1, 11.5**

- [x] 3. Update `PitchShifter.shift()` to accept and forward `engine`
  - [x] 3.1 Add `engine?: 'rubberband' | 'standard'` to the `options` parameter of `PitchShifter.shift()`, default `'rubberband'`
    - Extract `engine` from merged options and pass it to `PitchShiftClient.pitchShift()`
    - Replace the `shiftWithFFmpeg` delegation with a call to `PitchShiftClient` (delete `shiftWithFFmpeg`)
    - Retain the zero-semitone fast path (return input unchanged)
    - Reconstruct the output `AudioBuffer` from returned `Float32Array[]` via `AudioContext.createBuffer()`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 3.2 Write property test for FFmpeg path elimination (Property 4)
    - **Property 4: FFmpeg Path Eliminated**
    - `fc.asyncProperty(fc.float({ min: -48, max: 48, noNaN: true }).filter(s => s !== 0), ...)` — assert `mockEnqueue` never called
    - **Validates: Requirements 7.3, 10.3, 11.2**

  - [ ]* 3.3 Write unit tests for `PitchShifter.shift()` engine default and duration invariant
    - Verify `shift()` without explicit engine forwards `engine: 'rubberband'` (Requirement 11.5)
    - Verify duration invariant: mocked worker returns same-length channels → `output.duration === input.duration` (Requirement 11.3)
    - **Validates: Requirements 11.3, 11.5**

- [x] 4. Implement RubberBand engine in `PitchShift_Worker`
  - [x] 4.1 Add async WASM initialization block at worker startup
    - `import RubberBandModule from 'rubberband-wasm'` and call the async factory before handling any messages
    - Store the initialized module instance; set `wasmFailed = true` and record the error reason if init throws
    - _Requirements: 1.2, 1.4_

  - [x] 4.2 Add request queue to buffer messages arriving before init completes
    - Push incoming `PitchShiftRequest` messages onto a queue while `wasmReady === false`
    - Drain the queue in FIFO order after init succeeds; drain with error responses if init fails
    - _Requirements: 1.3, 1.4_

  - [x] 4.3 Implement `processRubberBand()` with WASM heap memory management
    - For each channel: allocate input buffer with `_malloc(length * 4)`, copy `Float32Array` into `HEAPF32`, run the Rubber Band processor, copy output from `HEAPF32` into a new `Float32Array`, free all pointers
    - Free all pointers in a `finally` block so memory is released even on error
    - Configure the processor with `RubberBandOptionPitchHighQuality` always, plus transient and formant flags from `options`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4_

  - [x] 4.4 Add engine routing in `onmessage`
    - Route `engine: 'rubberband'` → `processRubberBand()`; `engine: 'standard'` → existing `processWithFallback()`; unrecognized engine → error response
    - Send all responses with `postMessage(response, { transfer: outputChannels.map(c => c.buffer) })`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 4.5 Write property test for WASM heap round-trip fidelity (Property 5)
    - **Property 5: WASM Heap Round-Trip Fidelity**
    - `fc.property(fc.array(fc.float({ noNaN: true, min: -1, max: 1 }), { minLength: 1, maxLength: 4096 }), ...)` — write to heap, read back, assert each sample within 1e-6
    - **Validates: Requirements 2.5**

  - [ ]* 4.6 Write property test for init-failure error propagation (Property 6)
    - **Property 6: Init-Failure Error Propagation**
    - Simulate WASM init failure, send requests with `engine: 'rubberband'`, assert all responses contain `error` field
    - **Validates: Requirements 1.4**

  - [ ]* 4.7 Write property test for invalid engine rejection (Property 7)
    - **Property 7: Invalid Engine Rejection**
    - `fc.asyncProperty(fc.string().filter(s => s !== 'rubberband' && s !== 'standard'), ...)` — assert response has `error` field
    - **Validates: Requirements 5.3**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add `pitchEngine` state to `ProcessingSlice` and `EditorStore`
  - [x] 6.1 Add `pitchEngine: 'rubberband' | 'standard'` (default `'rubberband'`) to `ProcessingSliceState` and `processingInitialState` in `stores/slices/processingSlice.ts`
    - Add `setPitchEngine` to `ProcessingSliceActions`
    - _Requirements: 8.1_

  - [x] 6.2 Implement `setPitchEngine` action and update `pitchShiftTrack` in `stores/editorStore.ts`
    - Add `pitchEngine` and `setPitchEngine` to `EditorState` and the store implementation
    - Update `pitchShiftTrack` to read `state.pitchEngine` and pass it to `PitchShifter.shift()`
    - The `persist` middleware already serializes processing state, so `pitchEngine` is persisted automatically
    - _Requirements: 8.2, 8.3, 8.4_

  - [ ]* 6.3 Write unit test for `pitchEngine` initial state (Requirement 11.4)
    - Assert `processingInitialState.pitchEngine === 'rubberband'`
    - **Validates: Requirements 8.1, 11.4**

  - [ ]* 6.4 Write property test for `setPitchEngine` state update (Property 8)
    - **Property 8: setPitchEngine State Update**
    - `fc.property(fc.constantFrom('rubberband', 'standard'), engine => { store.getState().setPitchEngine(engine); expect(store.getState().pitchEngine).toBe(engine); })`
    - **Validates: Requirements 8.2**

- [x] 7. Add engine indicator and toggle to `InspectorPanel` Transposer section
  - Read `pitchEngine`, `setPitchEngine`, and `isProcessing` from `useEditorStore` in `InspectorPanel`
  - Add a clickable badge adjacent to the Transposer heading that shows "Engine: Rubber Band (Pro)" (purple badge) or "Engine: Standard" (neutral badge)
  - On click, call `setPitchEngine(pitchEngine === 'rubberband' ? 'standard' : 'rubberband')`
  - Disable the toggle while `isProcessing` is `true`
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8. Verify `AudioProcessor.pitchShift()` public signature is unchanged
  - Confirm `pitchShift(audioBuffer: AudioBuffer, semitones: number, options?: Partial<PitchShiftOptions>): Promise<AudioBuffer>` is unmodified
  - Confirm `AudioProcessor` does not reference `pitchEngine` from the store
  - Confirm no `MediaJobQueue.enqueue()` calls remain in the pitch-shift path
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests live in `__tests__/pitchShifter.property.test.ts` (already exists); unit tests extend `__tests__/pitchShifter.test.ts`
- Tag each property test with `// Feature: rubberband-pitch-shifter, Property N: <title>`
- Run tests with `npx vitest --run`
