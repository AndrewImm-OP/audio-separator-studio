import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileAudio, X, CheckCircle2, Clock, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
}

export function FileUpload({ file, onFileSelect }: FileUploadProps) {
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) {
        onFileSelect(accepted[0]);
      }
    },
    [onFileSelect],
  );

  // Read audio duration when file changes
  useEffect(() => {
    if (!file) {
      setAudioDuration(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    const handler = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };
    audio.addEventListener('loadedmetadata', handler);
    return () => {
      audio.removeEventListener('loadedmetadata', handler);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.opus', '.aiff'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const fmtSize = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  const fmtTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const ext = file?.name.split('.').pop()?.toUpperCase() || 'AUDIO';

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
          >
            <div
              {...getRootProps()}
              className="cursor-pointer relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200 p-4 text-center group"
              style={{
                borderColor: isDragActive ? 'var(--accent)' : 'var(--border-1)',
                background: isDragActive
                  ? 'var(--accent-light)'
                  : 'linear-gradient(180deg, rgba(30,32,48,0.4) 0%, rgba(22,24,34,0.6) 100%)',
              }}
            >
              <input {...getInputProps()} />

              <div className="flex flex-col items-center gap-2.5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 shadow-sm"
                  style={{
                    background: isDragActive
                      ? 'var(--accent)'
                      : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
                    border: '1px solid rgba(99,102,241,0.25)',
                  }}
                >
                  <Upload
                    className="w-5 h-5 transition-colors"
                    style={{ color: isDragActive ? 'white' : 'var(--accent-hover)' }}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                    {isDragActive ? 'Release to load audio' : 'Drop audio file or browse'}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Click to choose from your computer
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
                  {['WAV', 'FLAC', 'MP3', 'M4A', 'OGG', 'AIFF'].map((fmt) => (
                    <span
                      key={fmt}
                      className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="file-loaded"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="rounded-xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/20 to-zinc-900/80 p-3.5 shadow-lg relative overflow-hidden"
          >
            {/* Ambient accent top bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}
              >
                <FileAudio className="w-5 h-5 text-indigo-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {ext}
                  </span>
                  <p className="text-xs font-semibold text-zinc-100 truncate" title={file.name}>
                    {file.name}
                  </p>
                </div>

                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-400 font-mono">
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-zinc-500" />
                    {fmtSize(file.size)}
                  </span>
                  {audioDuration !== null && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Clock className="w-3 h-3" />
                      {fmtTime(audioDuration)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-indigo-300">
                    <CheckCircle2 className="w-3 h-3" />
                    Ready
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onFileSelect(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Remove audio file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
