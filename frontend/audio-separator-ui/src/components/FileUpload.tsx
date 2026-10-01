import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileAudio, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
}

export function FileUpload({ file, onFileSelect }: FileUploadProps) {
  const onDrop = useCallback(
    (accepted: File[]) => { if (accepted.length > 0) onFileSelect(accepted[0]); },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.opus'] },
    maxFiles: 1,
    multiple: false,
  });

  const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  return (
    <AnimatePresence mode="wait">
      {!file ? (
        <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div
            {...getRootProps()}
            className="cursor-pointer text-center transition-all duration-200"
            style={{
              borderRadius: 'var(--r-lg)',
              border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border-1)'}`,
              background: isDragActive ? 'var(--accent-light)' : 'transparent',
              padding: 'var(--sp-xl) var(--sp-lg)',
            }}
            onMouseEnter={(e) => {
              if (!isDragActive) {
                e.currentTarget.style.borderColor = 'var(--border-2)';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDragActive) {
                e.currentTarget.style.borderColor = 'var(--border-1)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all"
                style={{
                  background: isDragActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                  transform: isDragActive ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                <Upload className="w-5 h-5" style={{ color: isDragActive ? 'white' : 'var(--text-3)' }} />
              </div>
              <div>
                <p style={{ fontSize: 'var(--f-md)', fontWeight: 500, color: 'var(--text-1)' }}>
                  {isDragActive ? 'Drop audio file' : 'Drop audio file here'}
                </p>
                <p style={{ fontSize: 'var(--f-sm)', color: 'var(--text-2)', marginTop: '4px' }}>
                  or <span style={{ color: 'var(--accent)', fontWeight: 500 }}>browse files</span>
                </p>
                <p style={{ fontSize: 'var(--f-xs)', color: 'var(--text-3)', marginTop: '12px' }}>
                  MP3, WAV, FLAC, OGG, M4A, AAC, OPUS
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="file"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="card"
          style={{ padding: 'var(--sp-md)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-light)' }}
            >
              <FileAudio className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{ fontSize: 'var(--f-sm)', fontWeight: 600, color: 'var(--text-1)' }}>
                {file.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  style={{
                    fontSize: 'var(--f-xs)',
                    fontWeight: 500,
                    padding: '1px 6px',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-3)',
                  }}
                >
                  {file.name.split('.').pop()?.toUpperCase()}
                </span>
                <span style={{ fontSize: 'var(--f-xs)', color: 'var(--text-3)' }}>{fmtSize(file.size)}</span>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onFileSelect(null); }}
              className="btn btn-ghost btn-icon btn-sm"
              style={{ color: 'var(--text-3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--c-error)'; e.currentTarget.style.background = 'var(--c-error-light)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
