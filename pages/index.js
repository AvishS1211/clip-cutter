import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

function formatTime(seconds) {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '0:00:00:000';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${cs.toString().padStart(2, '0')}`;
}

function parseTime(str) {
  // Accepts H:MM:SS:mmm  or  H:MM:SS  or  M:SS  or  plain seconds
  const parts = str.trim().split(':');
  if (parts.some(p => isNaN(Number(p)))) return null;
  const nums = parts.map(Number);
  if (nums.length === 4) return nums[0] * 3600 + nums[1] * 60 + nums[2] + nums[3] / 100;
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  return nums[0];
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
    <div className="app-shell">

      {/* ── Left: Video Panel ── */}
      <div className="video-panel">
        {videoSrc ? (
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
        ) : (
          <div className="video-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3D3B37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <line x1="20" y1="4" x2="8.12" y2="15.88"/>
              <line x1="14.47" y1="14.48" x2="20" y2="20"/>
              <line x1="8.12" y1="8.12" x2="12" y2="12"/>
            </svg>
            <p>Paste a link and hit Download</p>
          </div>
        )}
      </div>

      {/* ── Right: Control Panel ── */}
      <div className="control-panel">

        {/* Header */}
        <div className="ctrl-header">
          <div className="header-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <line x1="20" y1="4" x2="8.12" y2="15.88"/>
              <line x1="14.47" y1="14.48" x2="20" y2="20"/>
              <line x1="8.12" y1="8.12" x2="12" y2="12"/>
            </svg>
          </div>
          <div>
            <h1>Clip Cutter</h1>
            <div className="header-sub">YouTube · X · Broadcasts</div>
          </div>
        </div>

        <hr className="divider" />

        {/* URL Input */}
        <div className="ctrl-section">
          <div className="url-row">
            <input
              className="url-input"
              type="text"
              placeholder="Paste YouTube, X and X broadcast link..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleDownload()}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 10 }}
            onClick={handleDownload}
            disabled={loading || !url.trim()}
          >
            {loading ? 'Downloading...' : 'Download'}
          </button>
          {loading && (
            <div className="progress-wrap">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${downloadProgress}%` }} />
              </div>
              <div className="progress-label">
                <span>{downloadStage === 'processing' ? 'Processing...' : `Downloading ${Math.round(downloadProgress)}%`}</span>
                <span>100%</span>
              </div>
            </div>
          )}
          {status && !loading && (
            <p className={`status ${status.startsWith('✗') ? 'error' : ''}`}>{status}</p>
          )}
        </div>

        {videoSrc && (
          <>
            <hr className="divider" />

            {/* In / Duration / Out */}
            <div className="ctrl-section">
              <div className="time-controls">
                <div className="time-cell">
                  <div className="time-label">Mark In</div>
                  <TimestampInput value={inPoint} onChange={handleInChange} className="green" max={outPoint - 0.1} />
                  <button className="btn btn-ghost time-set-btn" onClick={handleSetIn}>Set In</button>
                </div>
                <div className="time-cell">
                  <div className="time-label">Duration</div>
                  <span className="time-value-display muted">{formatTime(clipDuration)}</span>
                </div>
                <div className="time-cell">
                  <div className="time-label">Mark Out</div>
                  <TimestampInput value={outPoint} onChange={handleOutChange} className="red" max={duration} />
                  <button className="btn btn-ghost time-set-btn" onClick={handleSetOut}>Set Out</button>
                </div>
              </div>
            </div>

            <hr className="divider" />

            {/* Timeline */}
            <div className="ctrl-section">
              <div className="timeline-label">Timeline</div>
              <div
                className="timeline"
                ref={timelineRef}
                onMouseDown={(e) => { setIsDragging(true); handleTimelineClick(e); }}
              >
                {duration > 0 && (
                  <>
                    <div className="timeline-region" style={{ left: `${getTimelinePercent(inPoint)}%`, width: `${getTimelinePercent(outPoint) - getTimelinePercent(inPoint)}%` }} />
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

            <hr className="divider" />

            {/* Export */}
            <div className="ctrl-section">
              <button className="btn btn-primary export-btn" onClick={handleExportClick} disabled={exporting}>
                {exporting ? 'Exporting...' : 'Export Clip'}
              </button>
              {exportStatus && (
                <p className={`export-status ${exportStatus.startsWith('✓') ? 'success' : exportStatus.startsWith('✗') ? 'error' : ''}`}>
                  {exportStatus}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
