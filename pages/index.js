import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

function formatTime(seconds) {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseTime(str) {
  const parts = str.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function TimestampInput({ value, onChange, className, max }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    setDraft(formatTime(value));
    setEditing(true);
  };

  const commitEdit = () => {
    const parsed = parseTime(draft);
    if (parsed !== null && parsed >= 0 && (max === undefined || parsed <= max)) {
      onChange(parsed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className={`timestamp-input ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit();
          if (e.key === 'Escape') setEditing(false);
        }}
        autoFocus
        selectOnFocus
      />
    );
  }

  return (
    <span
      className={`timestamp-input ${className}`}
      onClick={startEdit}
      title="Click to edit"
      style={{ display: 'block', cursor: 'text' }}
    >
      {formatTime(value)}
    </span>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef(null);
  const timelineRef = useRef(null);

  const handleDownload = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setStatus('');
    setDownloadProgress(0);
    setDownloadStage('download');
    setVideoSrc('');
    setExportStatus('');

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.progress !== undefined) setDownloadProgress(data.progress);
            if (data.stage === 'processing') setDownloadStage('processing');
            if (data.success) {
              setVideoSrc(data.path);
              setDuration(data.duration);
              setInPoint(0);
              setOutPoint(data.duration);
              setDownloadStage('');
            }
            if (data.error) setStatus(`✗ ${data.error}`);
          } catch {}
        }
      }
    } catch (err) {
      setStatus(`✗ ${err.message || 'Download failed'}`);
    } finally {
      setLoading(false);
      setDownloadProgress(0);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const seekTo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSetIn = () => {
    if (videoRef.current) setInPoint(videoRef.current.currentTime);
  };

  const handleSetOut = () => {
    if (videoRef.current) setOutPoint(videoRef.current.currentTime);
  };

  const handleInChange = (val) => {
    const clamped = Math.min(val, outPoint - 0.1);
    setInPoint(Math.max(0, clamped));
    seekTo(Math.max(0, clamped));
  };

  const handleOutChange = (val) => {
    const clamped = Math.max(val, inPoint + 0.1);
    setOutPoint(Math.min(clamped, duration));
    seekTo(Math.min(clamped, duration));
  };

  const getTimelinePercent = (time) => duration ? (time / duration) * 100 : 0;

  const handleTimelineClick = useCallback((e) => {
    if (!timelineRef.current || !videoRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newTime = (x / rect.width) * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) handleTimelineClick(e);
  }, [isDragging, handleTimelineClick]);

  useEffect(() => {
    const stop = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stop);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stop);
    };
  }, [handleMouseMove]);

  const handleExportClick = async () => {
    if (!videoSrc) return;
    if (inPoint >= outPoint) {
      setExportStatus('✗ Mark In must be before Mark Out');
      return;
    }
    setExporting(true);
    setExportStatus('Exporting...');
    try {
      const res = await axios.post(
        '/api/export',
        { path: videoSrc, startTime: inPoint, endTime: outPoint },
        { responseType: 'blob' }
      );
      const blob = new Blob([res.data], { type: 'video/mp4' });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `clip-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      setExportStatus('✓ Clip downloaded!');
    } catch (err) {
      setExportStatus(`✗ ${err.response?.data?.error || 'Export failed'}`);
    } finally {
      setExporting(false);
    }
  };

  const clipDuration = outPoint - inPoint;

  return (
    <>
      <div className="container">
        <div className="header">
          <div className="header-logo">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5v14l11-7L8 5z" fill="white"/>
            </svg>
          </div>
          <div>
            <h1>Clip Cutter</h1>
            <div className="header-sub">Extract clips from any video URL</div>
          </div>
        </div>

        <div className="card">
          <div className="url-row">
            <input
              className="url-input"
              type="text"
              placeholder="Paste a YouTube, X, or any video URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleDownload()}
            />
            <button
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={loading || !url.trim()}
            >
              {loading ? 'Downloading...' : 'Download'}
            </button>
          </div>
          {loading && (
            <div className="progress-wrap">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${downloadProgress}%` }} />
              </div>
              <div className="progress-label">
                <span>{downloadStage === 'processing' ? 'Processing...' : `Downloading ${Math.round(downloadProgress)}%`}</span>
                <span>{Math.round(downloadProgress)}%</span>
              </div>
            </div>
          )}
          {status && !loading && (
            <p className={`status ${status.startsWith('✗') ? 'error' : ''}`}>{status}</p>
          )}
        </div>

        {videoSrc && (
          <div className="card">
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  const d = videoRef.current.duration;
                  if (d && !isNaN(d)) { setDuration(d); setOutPoint(d); }
                }
              }}
            />

            <div className="time-controls">
              <div className="time-cell">
                <div className="time-label">Mark In</div>
                <TimestampInput
                  value={inPoint}
                  onChange={handleInChange}
                  className="green"
                  max={outPoint - 0.1}
                />
                <button className="btn btn-ghost time-set-btn" onClick={handleSetIn}>Set In</button>
              </div>
              <div className="time-cell">
                <div className="time-label">Duration</div>
                <span className="time-value-display muted">{formatTime(clipDuration)}</span>
              </div>
              <div className="time-cell">
                <div className="time-label">Mark Out</div>
                <TimestampInput
                  value={outPoint}
                  onChange={handleOutChange}
                  className="red"
                  max={duration}
                />
                <button className="btn btn-ghost time-set-btn" onClick={handleSetOut}>Set Out</button>
              </div>
            </div>

            <hr className="divider" />

            <div className="timeline-wrap">
              <div className="timeline-label">Timeline</div>
              <div
                className="timeline"
                ref={timelineRef}
                onMouseDown={(e) => { setIsDragging(true); handleTimelineClick(e); }}
              >
                {duration > 0 && (
                  <>
                    <div
                      className="timeline-region"
                      style={{
                        left: `${getTimelinePercent(inPoint)}%`,
                        width: `${getTimelinePercent(outPoint) - getTimelinePercent(inPoint)}%`,
                      }}
                    />
                    <div className="timeline-progress" style={{ width: `${getTimelinePercent(currentTime)}%` }} />
                    <div className="timeline-in" style={{ left: `${getTimelinePercent(inPoint)}%` }} />
                    <div className="timeline-out" style={{ left: `${getTimelinePercent(outPoint)}%` }} />
                  </>
                )}
              </div>
              <div className="time-display">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <button
              className="btn btn-primary export-btn"
              onClick={handleExportClick}
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Export Clip'}
            </button>

            {exportStatus && (
              <p className={`export-status ${exportStatus.startsWith('✓') ? 'success' : exportStatus.startsWith('✗') ? 'error' : ''}`}>
                {exportStatus}
              </p>
            )}
          </div>
        )}
      </div>

    </>
  );
}
