export interface ModelInfo {
  key: string;
  name: string;
  model_type: string;
  stems: string[];
  sdr_metrics: Record<string, number>;
  description: string;
  size_mb: number;
  is_downloaded: boolean;
  config_path?: string;
  checkpoint_path?: string;
}

export interface ModelsResponse {
  models: Record<string, ModelInfo>;
  categories: Record<string, string[]>;
}

export interface EnsembleMethodInfo {
  key: string;
  name: string;
  description: string;
  domain: string;
}

export interface Job {
  id: string;
  status: 'queued' | 'downloading_model' | 'loading_model' | 'processing' | 'completed' | 'error';
  model_key?: string;
  model_keys?: string[];
  method?: string;
  input_file: string;
  progress: number;
  message: string;
  output_files: Record<string, string>;
}

export interface HealthResponse {
  status: string;
  cuda_available: boolean;
  cuda_device: string | null;
  loaded_models: string[];
}

export type SeparationMode = 'single' | 'ensemble';
