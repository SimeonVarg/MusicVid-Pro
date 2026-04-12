'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';

export interface UseAudioRecorderReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  discardRecording: () => void;
  elapsedSeconds: number;
  level: number; // 0–1 RMS amplitude
  isSupported: boolean;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [level, setLevel] = useState(0);

  const isSupported =
    typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  function stopAllTimers() {
    if (elapsedIntervalRef.current !== null) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }

  function startLevelLoop() {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(data);

      // Compute RMS
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(Math.min(1, rms));

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }

  const startRecording = useCallback(async () => {
    const { setIsRecording, setRecordingError, addAudioTrack } = useEditorStore.getState();

    // Acquire stream (reuse if already set)
    if (!streamRef.current) {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            setRecordingError('Microphone access is required to record audio.');
          } else if (error.name === 'NotFoundError') {
            setRecordingError('No microphone found. Please connect a microphone and try again.');
          } else {
            setRecordingError(error.message);
          }
        } else {
          setRecordingError('Microphone access is required to record audio.');
        }
        return;
      }
    }

    const stream = streamRef.current;

    // Determine preferred mimeType
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';

    // Create fresh MediaRecorder
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onerror = (e) => {
      stopAllTimers();
      useEditorStore.getState().setIsRecording(false);
      const errorMsg = (e as Event & { error?: DOMException }).error?.message ?? 'Recording error';
      useEditorStore.getState().setRecordingError(errorMsg);
      chunksRef.current = [];
      setLevel(0);
      setElapsedSeconds(0);
    };

    mediaRecorder.onstop = async () => {
      stopAllTimers();
      setLevel(0);
      setElapsedSeconds(0);

      const recorderMimeType = mediaRecorder.mimeType || mimeType;
      const blob = new Blob(chunksRef.current, { type: recorderMimeType });

      if (blob.size < 100) {
        useEditorStore.getState().setRecordingError('Recording was too short');
        useEditorStore.getState().setIsRecording(false);
        chunksRef.current = [];
        return;
      }

      const ext = recorderMimeType.includes('ogg') ? 'ogg' : 'webm';
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const filename = `recording-${timestamp}.${ext}`;
      const file = new File([blob], filename, { type: recorderMimeType });

      useEditorStore.getState().setIsRecording(false);

      try {
        await addAudioTrack(file);
      } catch {
        useEditorStore.getState().setRecordingError('Failed to process recording.');
      }

      chunksRef.current = [];
    };

    // Set up AudioContext + AnalyserNode for level metering
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    mediaRecorder.start(100);
    setIsRecording(true);

    // Start elapsed timer
    elapsedIntervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    // Start level RAF loop
    startLevelLoop();
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    // onstop handler does the rest
  }, []);

  const discardRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') {
      // Override onstop to no-op before stopping
      mr.onstop = null;
      mr.stop();
    }

    chunksRef.current = [];
    useEditorStore.getState().setIsRecording(false);
    stopAllTimers();
    setElapsedSeconds(0);
    setLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state === 'recording') {
        mr.onstop = null;
        mr.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopAllTimers();
    };
  }, []);

  return {
    startRecording,
    stopRecording,
    discardRecording,
    elapsedSeconds,
    level,
    isSupported,
  };
}
