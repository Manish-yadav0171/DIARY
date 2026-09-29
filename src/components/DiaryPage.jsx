import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heart,
  Sun,
  Moon,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Share2,
  Printer,
  FileDown,
  X,
  Tag,
  Loader2,
  Trash2
} from 'lucide-react';
import {
  formatDateToKey,
  getEntryByDate,
  saveOrUpdateEntry,
  getTodayDateKey,
  getPreviousDay,
  getNextDay,
  getSetting
} from '../database/diaryStore';
import {
  requestGoogleDocsToken,
  exportEntryToGoogleDocs,
  downloadEntryAsText,
  printDiaryEntry
} from '../export/googleDocs';

export default function DiaryPage({
  date = getTodayDateKey(),
  onDateChange,
  isDark,
  onToggleTheme
}) {
  const todayKey = getTodayDateKey();
  const dateKey = typeof date === 'string' ? date : formatDateToKey(date);
  const isToday = dateKey === todayKey;

  // Format date for display
  const [y, m, d] = dateKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dateFormatted = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Entry state
  const [entryId, setEntryId] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [tags, setTags] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [showDearDiary, setShowDearDiary] = useState(true);

  // Status & export states
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('Ready');
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const isInitialLoadRef = useRef(true);

  const moods = [
    { emoji: '😊', label: 'Happy' },
    { emoji: '😌', label: 'Calm' },
    { emoji: '☕', label: 'Reflective' },
    { emoji: '🌧️', label: 'Thoughtful' },
    { emoji: '✨', label: 'Inspired' }
  ];

  // 1. Load entry from IndexedDB on date change
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);
      isInitialLoadRef.current = true;

      try {
        const dearDiaryPref = await getSetting('dearDiaryEnabled', true);
        if (!isCancelled) setShowDearDiary(dearDiaryPref);

        const entry = await getEntryByDate(dateKey);

        if (!isCancelled) {
          if (entry) {
            setEntryId(entry.id);
            setTitle(entry.title || '');
            setContent(entry.content || '');
            setMood(entry.mood || null);
            setIsFavourite(Boolean(entry.favourite));
            setTags(entry.tags || []);
            setPhotos(entry.photos || []);
            if (entry.updatedAt) {
              const updated = new Date(entry.updatedAt);
              setLastSavedTime(
                updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              );
            }
            setSaveStatus('Saved locally');
          } else {
            setEntryId(null);
            setTitle('');
            setContent('');
            setMood(null);
            setIsFavourite(false);
            setTags([]);
            setPhotos([]);
            setLastSavedTime(null);
            setSaveStatus('Ready');
          }
        }
      } catch (err) {
        console.error('Error loading entry:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setTimeout(() => {
            isInitialLoadRef.current = false;
          }, 100);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [dateKey]);

  // 2. Direct save helper function
  const performSave = useCallback(
    async (overrideFields = {}) => {
      try {
        setSaveStatus('Saving...');
        const payload = {
          id: entryId,
          date: dateKey,
          title,
          content,
          mood,
          favourite: isFavourite,
          tags,
          photos,
          ...overrideFields
        };

        const saved = await saveOrUpdateEntry(payload);
        if (saved && saved.id) {
          setEntryId(saved.id);
        }
        setSaveStatus('Saved locally');
        const now = new Date();
        setLastSavedTime(
          now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );
        return saved;
      } catch (err) {
        console.error('Save failed:', err);
        setSaveStatus('Error saving');
        return null;
      }
    },
    [entryId, dateKey, title, content, mood, isFavourite, tags, photos]
  );

  // 3. Debounced autosave
  const scheduleAutosave = useCallback(
    (newTitle, newContent) => {
      if (isInitialLoadRef.current) return;

      setSaveStatus('Writing...');
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

      autosaveTimerRef.current = setTimeout(() => {
        performSave({ title: newTitle, content: newContent });
      }, 650);
    },
    [performSave]
  );

  // 4. Safe day navigation
  const handleNavigateDay = useCallback(
    async (targetDateKey) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        await performSave();
      }
      if (onDateChange) {
        onDateChange(targetDateKey);
      }
    },
    [onDateChange, performSave]
  );

  // 5. Textarea resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(280, textareaRef.current.scrollHeight)}px`;
    }
  }, [content]);

  // 6. Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        performSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onToggleTheme();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        printDiaryEntry({ date: dateKey, title, content, mood, tags });
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigateDay(getPreviousDay(dateKey));
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateDay(getNextDay(dateKey));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performSave, onToggleTheme, handleNavigateDay, dateKey, title, content, mood, tags]);

  // Handle Tab key in textarea
  const handleKeyDownTextarea = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);
      scheduleAutosave(title, newContent);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  // Immediate save on Mood change
  const handleMoodSelect = (selectedMood) => {
    const nextMood = mood === selectedMood ? null : selectedMood;
    setMood(nextMood);
    performSave({ mood: nextMood });
  };

  // Immediate save on Favourite toggle
  const handleFavouriteToggle = () => {
    const nextFav = !isFavourite;
    setIsFavourite(nextFav);
    performSave({ favourite: nextFav });
  };

  // Photo Attachment Handler
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result;
        const newPhoto = {
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dataUrl,
          createdAt: new Date().toISOString()
        };
        const nextPhotos = [...photos, newPhoto];
        setPhotos(nextPhotos);
        await performSave({ photos: nextPhotos });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleDeletePhoto = async (photoId) => {
    const nextPhotos = photos.filter((p) => p.id !== photoId);
    setPhotos(nextPhotos);
    await performSave({ photos: nextPhotos });
  };

  // Tags Handler
  const handleAddTag = async (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const cleanTag = tagInput.trim().replace(/^#/, '').toLowerCase();
      if (!tags.includes(cleanTag)) {
        const nextTags = [...tags, cleanTag];
        setTags(nextTags);
        setTagInput('');
        await performSave({ tags: nextTags });
      } else {
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    await performSave({ tags: nextTags });
  };

  // Export handlers
  const handleExportGoogleDocs = async () => {
    setIsExporting(true);
    setShowExportMenu(false);
    setExportFeedback('Connecting to Google Docs...');

    try {
      const clientId =
        (await getSetting('googleClientId')) ||
        import.meta.env.VITE_GOOGLE_CLIENT_ID ||
        '';

      if (!clientId) {
        throw new Error('Please configure your Google OAuth Client ID in Settings first.');
      }

      const token = await requestGoogleDocsToken(clientId);
      setExportFeedback('Creating formatted Google Doc...');

      const result = await exportEntryToGoogleDocs(token, {
        date: dateKey,
        title,
        content,
        mood,
        tags
      });

      setExportFeedback(`Exported! Opening Google Doc...`);
      window.open(result.docUrl, '_blank');
      setTimeout(() => setExportFeedback(null), 4000);
    } catch (err) {
      console.error('Google Docs export failed:', err);
      setExportFeedback(`Export failed: ${err.message}`);
      setTimeout(() => setExportFeedback(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadMarkdown = () => {
    setShowExportMenu(false);
    downloadEntryAsText({ date: dateKey, title, content, mood, tags });
  };

  const handlePrintEntry = () => {
    setShowExportMenu(false);
    printDiaryEntry({ date: dateKey, title, content, mood, tags });
  };

  // Word & character counts
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <article className="diary-sheet" aria-label="Diary Entry">
      {/* Page Navigation Bar */}
      <nav className="page-nav-bar" aria-label="Day navigation">
        <button
          type="button"
          className="page-nav-btn"
          onClick={() => handleNavigateDay(getPreviousDay(dateKey))}
          title="Previous day (Alt + ←)"
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </button>

        {!isToday && (
          <button
            type="button"
            className="return-today-pill"
            onClick={() => handleNavigateDay(todayKey)}
            title="Return to Today's page"
          >
            Return to Today
          </button>
        )}

        <button
          type="button"
          className="page-nav-btn"
          onClick={() => handleNavigateDay(getNextDay(dateKey))}
          title="Next day (Alt + →)"
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </nav>

      {/* Header Section */}
      <header className="diary-header">
        <div className="diary-header-top">
          <div className="diary-date-group">
            <span className="diary-weekday">{weekday}</span>
            <h1 className="diary-date">{dateFormatted}</h1>
          </div>

          <div className="diary-header-actions">
            {/* Export Menu */}
            <div className="export-menu-wrapper">
              <button
                className="icon-button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export or Print this entry"
                aria-label="Export options"
              >
                <Share2 size={18} />
              </button>

              {showExportMenu && (
                <div className="export-dropdown" role="menu">
                  <button
                    className="export-option-btn"
                    onClick={handleExportGoogleDocs}
                    disabled={isExporting}
                  >
                    <FileDown size={16} color="var(--accent-warm)" />
                    <span>Export to Google Docs</span>
                  </button>
                  <button
                    className="export-option-btn"
                    onClick={handleDownloadMarkdown}
                  >
                    <FileDown size={16} />
                    <span>Download Markdown (.md)</span>
                  </button>
                  <button
                    className="export-option-btn"
                    onClick={handlePrintEntry}
                  >
                    <Printer size={16} />
                    <span>Print / Save as PDF</span>
                  </button>
                </div>
              )}
            </div>

            <button
              className="icon-button mobile-only-theme"
              onClick={onToggleTheme}
              title={isDark ? 'Switch to Paper Mode' : 'Switch to Night Mode'}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <button
              className={`icon-button ${isFavourite ? 'active' : ''}`}
              onClick={handleFavouriteToggle}
              title={isFavourite ? 'Remove from Favourites' : 'Mark as Favourite'}
              aria-label="Toggle favourite"
            >
              <Heart size={19} fill={isFavourite ? '#e05d5d' : 'none'} />
            </button>
          </div>
        </div>

        {/* Export Feedback notification */}
        {exportFeedback && (
          <div style={{ fontSize: '0.78rem', color: 'var(--accent-warm)', marginTop: '0.4rem' }}>
            {exportFeedback}
          </div>
        )}

        {/* Mood Selector */}
        <div className="mood-picker" role="group" aria-label="Select mood">
          <span className="mood-label">Mood:</span>
          <div className="mood-options">
            {moods.map((m) => (
              <button
                key={m.label}
                type="button"
                className={`mood-btn ${mood === m.label ? 'selected' : ''}`}
                onClick={() => handleMoodSelect(m.label)}
                title={m.label}
                aria-label={m.label}
                aria-pressed={mood === m.label}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Title Input */}
        <input
          type="text"
          className="diary-title-input"
          placeholder="Entry title (optional)..."
          value={title}
          disabled={isLoading}
          onChange={(e) => {
            const nextTitle = e.target.value;
            setTitle(nextTitle);
            scheduleAutosave(nextTitle, content);
          }}
          aria-label="Entry title"
        />

        {/* Tags & Action Row */}
        <div className="diary-extra-actions">
          {/* Add Photo Button */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />
          <button
            type="button"
            className="diary-action-pill"
            onClick={() => fileInputRef.current?.click()}
            title="Attach a photo to today's page"
          >
            <ImageIcon size={14} />
            <span>Add Photo</span>
          </button>

          {/* Tags Chips */}
          <div className="diary-tags-container">
            {tags.map((t) => (
              <span key={t} className="tag-chip">
                #{t}
                <span
                  className="tag-remove-btn"
                  onClick={() => handleRemoveTag(t)}
                  role="button"
                  aria-label={`Remove tag ${t}`}
                >
                  ×
                </span>
              </span>
            ))}
            <input
              type="text"
              className="tag-input"
              placeholder="+ add tag (Enter)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              aria-label="Add tag"
            />
          </div>
        </div>
      </header>

      {/* Writing Area */}
      <div className="diary-body">
        {showDearDiary && (
          <div className="dear-diary-prompt">Dear Diary,</div>
        )}
        <textarea
          ref={textareaRef}
          className="diary-textarea"
          placeholder="What's on your mind today? Pour your thoughts here..."
          value={content}
          disabled={isLoading}
          onChange={(e) => {
            const nextContent = e.target.value;
            setContent(nextContent);
            scheduleAutosave(title, nextContent);
          }}
          onKeyDown={handleKeyDownTextarea}
          aria-label="Diary content"
          autoFocus
        />

        {/* Attached Photos (Polaroid / Tape Gallery) */}
        {photos.length > 0 && (
          <div className="diary-photos-gallery" aria-label="Attached photos">
            {photos.map((p) => (
              <div key={p.id} className="polaroid-frame">
                <div className="photo-tape" />
                <img
                  src={p.dataUrl}
                  alt="Diary attachment"
                  className="polaroid-img"
                  loading="lazy"
                />
                <button
                  type="button"
                  className="photo-delete-btn"
                  onClick={() => handleDeletePhoto(p.id)}
                  title="Remove photo"
                  aria-label="Remove photo"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <footer className="diary-footer">
        <div className="diary-status">
          {saveStatus === 'Saving...' ? (
            <>
              <span className="status-dot saving" />
              <span>Saving...</span>
            </>
          ) : saveStatus === 'Saved locally' ? (
            <>
              <span className="status-dot saved" />
              <span className="status-saved">
                <Check size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                Saved locally
              </span>
              {lastSavedTime && (
                <span className="last-saved-time">· {lastSavedTime}</span>
              )}
            </>
          ) : saveStatus === 'Writing...' ? (
            <>
              <span className="status-dot writing" />
              <span>Writing...</span>
            </>
          ) : (
            <>
              <span className="status-dot ready" />
              <span>Ready to write</span>
            </>
          )}

          <span className="keyboard-hint" title="PC shortcut to quick save">
            (Ctrl+S)
          </span>
        </div>

        <div className="diary-counts">
          <span className="diary-wordcount">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          {charCount > 0 && (
            <span className="diary-charcount">· {charCount} chars</span>
          )}
        </div>
      </footer>
    </article>
  );
}
