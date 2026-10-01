import axios from 'axios';
import type {
  ModelsResponse,
  ModelInfo,
  EnsembleMethodInfo,
  Job,
  HealthResponse,
} from '../types';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'http://localhost:8000/api';
  }
  return '/api';
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 300000, // 5 min for large uploads
});

// ─── Health ──────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get('/health');
  return data;
}

// ─── Models ──────────────────────────────────────────────────────────────────

export async function getModels(): Promise<ModelsResponse> {
  const { data } = await api.get('/models');
  return data;
}

export async function getModelInfo(key: string): Promise<ModelInfo> {
  const { data } = await api.get(`/models/${key}`);
  return data;
}

export async function downloadModel(key: string): Promise<{ status: string }> {
  const { data } = await api.post(`/models/${key}/download`);
  return data;
}

export async function deleteModel(key: string): Promise<{ status: string }> {
  const { data } = await api.delete(`/models/${key}`);
  return data;
}

// ─── Separation ──────────────────────────────────────────────────────────────

export async function separateAudio(
  file: File,
  modelKey: string,
  overlap: number = 0.25,
  chunkSize: number = 485100,
  outputFormat: string = 'wav_16',
  lowVram: boolean = false,
): Promise<{ job_id: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model_key', modelKey);
  formData.append('overlap', overlap.toString());
  formData.append('chunk_size', chunkSize.toString());
  formData.append('output_format', outputFormat);
  formData.append('low_vram', lowVram ? 'true' : 'false');

  const { data } = await api.post('/separate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function ensembleSeparate(
  file: File,
  modelKeys: string[],
  method: string = 'avg_wave',
  weights?: number[],
): Promise<{ job_id: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model_keys', JSON.stringify(modelKeys));
  formData.append('method', method);
  if (weights) {
    formData.append('weights', JSON.stringify(weights));
  }

  const { data } = await api.post('/ensemble', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export async function getJobStatus(jobId: string): Promise<Job> {
  const { data } = await api.get(`/jobs/${jobId}`);
  return data;
}

export function getStemDownloadUrl(jobId: string, stemName: string): string {
  return `${getApiBaseUrl()}/jobs/${jobId}/download/${stemName}`;
}

export function getAllStemsDownloadUrl(jobId: string): string {
  return `${getApiBaseUrl()}/jobs/${jobId}/download-all`;
}

export function getOriginalAudioUrl(jobId: string): string {
  return `${getApiBaseUrl()}/jobs/${jobId}/original`;
}

export async function cancelJob(jobId: string): Promise<{ status: string }> {
  const { data } = await api.post(`/jobs/${jobId}/cancel`);
  return data;
}

export async function deleteJob(jobId: string): Promise<void> {
  await api.delete(`/jobs/${jobId}`);
}

// ─── Ensemble Methods ────────────────────────────────────────────────────────

export async function getEnsembleMethods(): Promise<{ methods: EnsembleMethodInfo[] }> {
  const { data } = await api.get('/ensemble-methods');
  return data;
}

// ─── WebSocket ───────────────────────────────────────────────────────────────

export function createWebSocket(clientId: string): WebSocket {
  let wsUrl = `ws://localhost:8000/ws/${clientId}`;
  if (typeof window !== 'undefined' && window.location.protocol !== 'file:' && window.location.host) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}/ws/${clientId}`;
  }
  return new WebSocket(wsUrl);
}
