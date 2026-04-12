# Requirements Document

## Introduction

MusicVid Pro currently uses FFmpeg's `asetrate + aresample` pipeline for audio pitch shifting. While fast, this approach degrades audio quality — particularly at larger semitone intervals — because it is a resampling-based technique that introduces timbre shift and does not preserve transients or formants.

This feature replaces that pipeline with the **Rubber Band Library** via WebAssembly (`rubberband-wasm`), the industry-standard phase-locked vocoder used in professional DAWs. The implementation runs strictly client-side in a dedicated Web Worker, preserves audio duration, and exposes the active engine to the user via a UI indicator in the Transposer section of the Inspector Panel.

---

## Glossary

- **RubberBand_Engine**: The Rubber Band WASM pitch-shifting backend, initialized asynchronously inside the Web Worker on startup.
- **Standard_Engine**: The existing FFmpeg `asetrate + aresample` pitch-shifting fallback path.
- **PitchShift_Worker**: The Web Worker defined in `lib/workers/pitchShift.worker.ts` that performs off-main-thread pitch shifting.
- **PitchShifter**: The class defined in `lib/audio/pitchShifter.ts` that orchestrates pitch shifting and delegates to the PitchShift_Worker via PitchShiftClient.
- **PitchShiftClient**: The typed wrapper in `lib/workers/pitchShiftClient.ts` that manages Worker communication and promise resolution.
- **PitchShiftRequest**: The message type sent from PitchShiftClient to PitchShift_Worker.
- **PitchShiftResponse**: The message type sent from PitchShift_Worker back to PitchShiftClient.
- **WASM_Heap**: The linear memory buffer managed by the Rubber Band WASM module, used to pass Float32Array channel data between JavaScript and the WASM instance.
- **EditorStore**: The Zustand store defined in `stores/editorStore.ts`.
- **ProcessingSlice**: The domain slice in `stores/slices/processingSlice.ts` that owns async media processing state.
- **Transposer_UI**: The Transposer section within `components/editor/InspectorPanel.tsx` that houses the pitch slider and apply button.
- **pitchEngine**: A store state property of type `'rubberband' | 'standard'` that selects the active pitch-shifting backend.
- **AudioBuffer**: A Web Audio API object containing decoded PCM audio data with a defined `duration`, `sampleRate`, `numberOfChannels`, and `length`.
- **Semitone**: A unit of musical pitch equal to one half-step; 12 semitones equals one octave.
- **Transferable**: A JavaScript object (e.g. `ArrayBuffer`) that can be transferred to a Worker with zero-copy semantics, detaching the buffer from the sender.

---

## Requirements

### Requirement 1: npm Package Selection and WASM Module Integration

**User Story:** As a developer integrating the Rubber Band Library, I want a clear specification of which npm package to install and how the WASM module is initialized, so that I can set up the dependency correctly without ambiguity.

#### Acceptance Criteria

1. THE PitchShift_Worker SHALL use the `rubberband-wasm` npm package (install via `npm install rubberband-wasm`) as the source of the Rubber Band WASM module.
2. WHEN the PitchShift_Worker script is first loaded, THE PitchShift_Worker SHALL asynchronously initialize the RubberBand_Engine by calling the module's async factory function before processing any PitchShiftRequest messages.
3. WHILE the RubberBand_Engine is initializing, THE PitchShift_Worker SHALL queue incoming PitchShiftRequest messages and process them after initialization completes.
4. IF the RubberBand_Engine fails to initialize, THEN THE PitchShift_Worker SHALL set an internal flag marking the engine as unavailable and respond to all subsequent PitchShiftRequest messages with a PitchShiftResponse containing an `error` field describing the failure.

---

### Requirement 2: WASM Heap Memory Management

**User Story:** As a developer, I want the Web Worker to correctly allocate and free WASM heap memory for each pitch-shift operation, so that the application does not leak memory over repeated uses.

#### Acceptance Criteria

1. WHEN a PitchShiftRequest with `engine: 'rubberband'` is received, THE PitchShift_Worker SHALL allocate a contiguous block of WASM_Heap memory sufficient to hold all input Float32Array channel data using the WASM module's `_malloc` (or equivalent) function.
2. WHEN the RubberBand_Engine has finished processing a channel, THE PitchShift_Worker SHALL read the output Float32Array data from the WASM_Heap into a new JavaScript Float32Array before freeing any WASM_Heap pointers.
3. WHEN output data has been copied from the WASM_Heap into JavaScript Float32Arrays, THE PitchShift_Worker SHALL immediately free all allocated WASM_Heap pointers using the WASM module's `_free` (or equivalent) function.
4. IF an error occurs during WASM processing after memory has been allocated, THEN THE PitchShift_Worker SHALL free all allocated WASM_Heap pointers before sending the error PitchShiftResponse.
5. FOR ALL valid input AudioBuffers processed by the RubberBand_Engine, the Float32Array data written to the WASM_Heap and subsequently read back SHALL be numerically equivalent to the original input data (within IEEE 754 float32 precision).

---

### Requirement 3: Output Duration Preservation

**User Story:** As a user applying pitch shifting to an audio track, I want the output audio to have the same duration as the input, so that the track remains in sync with the video timeline after transposition.

#### Acceptance Criteria

1. WHEN the RubberBand_Engine processes an AudioBuffer, THE RubberBand_Engine SHALL produce output channel data whose duration differs from the input AudioBuffer's duration by no more than 10 milliseconds.
2. THE PitchShifter SHALL reconstruct the output AudioBuffer using the original `sampleRate` and `numberOfChannels` from the input AudioBuffer.
3. FOR ALL valid input AudioBuffers with semitone values in the range [-48, +48], the output AudioBuffer's `duration` SHALL satisfy: `|output.duration - input.duration| <= 0.010` seconds.

---

### Requirement 4: Transient and Formant Preservation

**User Story:** As a musician using MusicVid Pro, I want pitch-shifted audio to retain the natural attack and timbre of the original recording, so that the result sounds professional rather than robotic.

#### Acceptance Criteria

1. WHEN initializing the RubberBand_Engine for a pitch-shift operation, THE PitchShift_Worker SHALL configure the Rubber Band processor with the `RubberBandOptionTransientsSmooth` or `RubberBandOptionTransientsCrisp` flag based on the `transientPreservation` field in the PitchShiftRequest options.
2. WHERE the `formantCorrection` option in the PitchShiftRequest is `true`, THE PitchShift_Worker SHALL configure the Rubber Band processor with the `RubberBandOptionFormantPreserved` flag.
3. WHERE the `formantCorrection` option in the PitchShiftRequest is `false`, THE PitchShift_Worker SHALL configure the Rubber Band processor with the `RubberBandOptionFormantShifted` flag.
4. THE PitchShift_Worker SHALL use the `RubberBandOptionPitchHighQuality` flag (phase-locked vocoder mode) for all pitch-shift operations performed by the RubberBand_Engine.

---

### Requirement 5: Engine Routing in the Web Worker

**User Story:** As a developer, I want the Web Worker to route pitch-shift requests to the correct engine based on the `engine` field in the request, so that both the Rubber Band and standard paths are exercised correctly.

#### Acceptance Criteria

1. WHEN a PitchShiftRequest is received with `engine: 'rubberband'`, THE PitchShift_Worker SHALL process the request using the RubberBand_Engine.
2. WHEN a PitchShiftRequest is received with `engine: 'standard'`, THE PitchShift_Worker SHALL process the request using the existing JS Phase Vocoder fallback path.
3. IF a PitchShiftRequest is received with an unrecognized `engine` value, THEN THE PitchShift_Worker SHALL respond with a PitchShiftResponse containing an `error` field.
4. THE PitchShift_Worker SHALL send the PitchShiftResponse using `postMessage` with a `transfer` list containing all output `Float32Array` buffers as Transferable objects.

---

### Requirement 6: PitchShiftRequest and PitchShiftResponse Message Interface

**User Story:** As a developer, I want the message types between PitchShiftClient and PitchShift_Worker to include the engine selection, so that the correct backend is invoked for each request.

#### Acceptance Criteria

1. THE PitchShiftRequest type SHALL include an `engine` field of type `'rubberband' | 'standard'`.
2. THE PitchShiftClient SHALL include the `engine` field in every PitchShiftRequest it sends to the PitchShift_Worker, sourcing the value from the `engine` parameter passed to `PitchShiftClient.pitchShift()`.
3. THE PitchShiftResponse type SHALL remain unchanged: a discriminated union of a success shape (with `channels: Float32Array[]` and `sampleRate: number`) and an error shape (with `error: string`).

---

### Requirement 7: PitchShifter Class Update

**User Story:** As a developer, I want the PitchShifter class to accept and forward the engine selection, so that the store's `pitchEngine` value reaches the worker without requiring changes to AudioProcessor.

#### Acceptance Criteria

1. THE PitchShifter SHALL accept an optional `engine` parameter of type `'rubberband' | 'standard'` in its `shift()` method signature, defaulting to `'rubberband'`.
2. WHEN `PitchShifter.shift()` is called, THE PitchShifter SHALL pass the `engine` value to `PitchShiftClient.pitchShift()` as part of the request.
3. THE PitchShifter SHALL continue to delegate all non-zero semitone pitch-shift operations to the PitchShift_Worker via PitchShiftClient, replacing the existing FFmpeg `shiftWithFFmpeg` path entirely.
4. THE PitchShifter SHALL retain the zero-semitone fast path: WHEN `semitones === 0`, THE PitchShifter SHALL return the input AudioBuffer unchanged without invoking the worker.
5. THE PitchShifter SHALL reconstruct the output AudioBuffer from the Float32Arrays returned by PitchShiftClient using the Web Audio API `AudioContext.createBuffer()`.

---

### Requirement 8: EditorStore pitchEngine State

**User Story:** As a developer, I want the EditorStore to expose a `pitchEngine` property and a setter action, so that the UI and processing pipeline can read and update the active engine selection.

#### Acceptance Criteria

1. THE ProcessingSlice SHALL define a `pitchEngine` state property of type `'rubberband' | 'standard'` with a default value of `'rubberband'`.
2. THE EditorStore SHALL expose a `setPitchEngine` action that accepts a value of type `'rubberband' | 'standard'` and updates the `pitchEngine` state.
3. THE EditorStore's `pitchShiftTrack` action SHALL read the current `pitchEngine` value from state and pass it to `PitchShifter.shift()`.
4. WHEN the EditorStore is rehydrated from persisted state, THE EditorStore SHALL restore the `pitchEngine` value if present, otherwise default to `'rubberband'`.

---

### Requirement 9: Transposer UI Engine Indicator

**User Story:** As a user, I want to see which pitch-shifting engine is active in the Transposer section of the Inspector Panel, so that I know when the high-quality Rubber Band engine is being used.

#### Acceptance Criteria

1. THE Transposer_UI SHALL display a visual engine indicator adjacent to the Transposer heading that shows the currently active `pitchEngine` value from the EditorStore.
2. WHEN `pitchEngine` is `'rubberband'`, THE Transposer_UI SHALL display the text "Engine: Rubber Band (Pro)" with a distinct visual style (e.g. a purple or green badge) to communicate premium quality.
3. WHEN `pitchEngine` is `'standard'`, THE Transposer_UI SHALL display the text "Engine: Standard" with a neutral visual style.
4. THE Transposer_UI SHALL provide an interactive toggle (button or clickable badge) that calls `setPitchEngine` to switch between `'rubberband'` and `'standard'`.
5. WHILE `isProcessing` is `true`, THE Transposer_UI SHALL disable the engine toggle to prevent switching engines mid-operation.

---

### Requirement 10: AudioProcessor Compatibility

**User Story:** As a developer, I want the existing `AudioProcessor.pitchShift()` method to remain unchanged in its public signature, so that no call sites outside the store need to be updated.

#### Acceptance Criteria

1. THE AudioProcessor's `pitchShift()` method signature SHALL remain: `pitchShift(audioBuffer: AudioBuffer, semitones: number, options?: Partial<PitchShiftOptions>): Promise<AudioBuffer>`.
2. THE AudioProcessor SHALL continue to delegate pitch shifting to `PitchShifter.shift()` without directly referencing the `pitchEngine` store value.
3. THE AudioProcessor SHALL NOT call `MediaJobQueue.getInstance().enqueue()` for pitch-shift operations (the FFmpeg path is fully replaced).

---

### Requirement 11: Test Coverage

**User Story:** As a developer, I want the test suite in `__tests__/pitchShifter.test.ts` to cover the new engine routing, message interface, and duration invariant, so that regressions are caught automatically.

#### Acceptance Criteria

1. THE test suite SHALL verify that `PitchShiftRequest` messages include the `engine` field with the value passed to `PitchShiftClient.pitchShift()`.
2. THE test suite SHALL verify that `AudioProcessor.pitchShift()` does NOT call `MediaJobQueue.enqueue()` for any semitone value (confirming the FFmpeg path is removed).
3. THE test suite SHALL verify the duration invariant: for a mocked worker that returns channel data of the same length as the input, the output `AudioBuffer.duration` equals the input `AudioBuffer.duration`.
4. THE test suite SHALL verify that the `pitchEngine` initial state in the EditorStore (via `processingInitialState`) is `'rubberband'`.
5. THE test suite SHALL verify that `PitchShifter.shift()` defaults the `engine` parameter to `'rubberband'` when not explicitly provided.
6. FOR ALL valid semitone values in [-48, +48] and input lengths in [1, 441000], the output channel data length returned by the worker SHALL equal the input channel data length (duration invariant property).
