import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, PenLine, Heart } from 'lucide-react';
import {
  formatDateToKey,
  getTodayDateKey,
  getEntriesForMonth,
  getEntryByDate
} from '../database/diaryStore';
import '../styles/calendar.css';

export default function Calendar({ onSelectDate }) {
  const todayKey = getTodayDateKey();
  const [todayY, todayM, todayD] = todayKey.split('-').map(Number);

  // Month currently displayed in calendar (1-indexed month)
  const [currentYear, setCurrentYear] = useState(todayY);
  const [currentMonth, setCurrentMonth] = useState(todayM);

  // Selected date key (defaults to today)
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Map of entries for the current month: { 'YYYY-MM-DD': entry }
  const [monthEntries, setMonthEntries] = useState({});

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // 1. Fetch entries whenever the displayed month/year changes
  useEffect(() => {
    let isCancelled = false;

    async function loadMonth() {
      const entries = await getEntriesForMonth(currentYear, currentMonth);
      if (!isCancelled) {
        const map = {};
        entries.forEach((e) => {
          map[e.date] = e;
        });
        setMonthEntries(map);
      }
    }

    loadMonth();
    return () => {
      isCancelled = true;
    };
  }, [currentYear, currentMonth]);

  // 2. Fetch selected entry when selected date changes
  useEffect(() => {
    let isCancelled = false;

    async function loadSelected() {
      const entry = await getEntryByDate(selectedDateKey);
      if (!isCancelled) {
        setSelectedEntry(entry);
      }
    }

    loadSelected();
    return () => {
      isCancelled = true;
    };
  }, [selectedDateKey]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleJumpToToday = () => {
    setCurrentYear(todayY);
    setCurrentMonth(todayM);
    setSelectedDateKey(todayKey);
  };

  // Generate grid calendar days (Mon=0, ..., Sun=6)
  const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();
  // In JS Date: 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Convert so Monday is 0:
  const leadingBlanks = (firstDayIndex + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  const dayCells = [];
  // Empty leading cells
  for (let i = 0; i < leadingBlanks; i++) {
    dayCells.push({ key: `blank-${i}`, isBlank: true });
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(currentMonth).padStart(2, '0');
    const dateKey = `${currentYear}-${monthStr}-${dayStr}`;
    const entry = monthEntries[dateKey];

    dayCells.push({
      key: dateKey,
      dateKey,
      dayNumber: day,
      hasEntry: Boolean(entry && (entry.content || entry.title)),
      entry,
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey
    });
  }

  // Format selected date preview header
  const [selY, selM, selD] = selectedDateKey.split('-').map(Number);
  const selectedDateObj = new Date(selY, selM - 1, selD);
  const selectedDateDisplay = selectedDateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const selectedWordCount =
    selectedEntry && selectedEntry.content
      ? selectedEntry.content.trim().split(/\s+/).length
      : 0;

  return (
    <div className="calendar-card">
      {/* Calendar Navigation Header */}
      <header className="calendar-header">
        <div className="calendar-title-group">
          <h2 className="calendar-month-title">{monthNames[currentMonth - 1]}</h2>
          <span className="calendar-year">{currentYear}</span>
        </div>

        <div className="calendar-controls">
          <button
            className="today-chip-btn"
            onClick={handleJumpToToday}
            title="Go to Today"
          >
            Today
          </button>
          <button
            className="icon-button"
            onClick={handlePrevMonth}
            title="Previous Month"
            aria-label="Previous Month"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="icon-button"
            onClick={handleNextMonth}
            title="Next Month"
            aria-label="Next Month"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Weekday Labels (Mon - Sun) */}
      <div className="calendar-grid">
        {weekdays.map((wd) => (
          <div key={wd} className="weekday-header">
            {wd}
          </div>
        ))}

        {/* Days */}
        {dayCells.map((cell) => {
          if (cell.isBlank) {
            return <div key={cell.key} className="calendar-day-cell empty-day" />;
          }

          return (
            <button
              key={cell.key}
              type="button"
              className={`calendar-day-cell ${cell.hasEntry ? 'has-entry' : ''} ${
                cell.isToday ? 'today' : ''
              } ${cell.isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedDateKey(cell.dateKey)}
              aria-label={`Date ${cell.dateKey}`}
              aria-selected={cell.isSelected}
            >
              <span>{cell.dayNumber}</span>
              <div className="entry-indicator-container">
                {cell.hasEntry && (
                  cell.entry?.mood ? (
                    <span className="entry-mood-badge">{cell.entry.mood}</span>
                  ) : (
                    <span className="entry-dot" />
                  )
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Date Preview Sheet */}
      <section className="date-preview-card" aria-label="Date preview">
        <div className="preview-header">
          <span className="preview-date">{selectedDateDisplay}</span>
          {selectedEntry && (
            <div className="preview-meta">
              {selectedEntry.favourite && (
                <Heart size={15} fill="#e05d5d" color="#e05d5d" />
              )}
              {selectedEntry.mood && <span>{selectedEntry.mood}</span>}
              <span>
                {selectedWordCount} {selectedWordCount === 1 ? 'word' : 'words'}
              </span>
            </div>
          )}
        </div>

        {selectedEntry && (selectedEntry.content || selectedEntry.title) ? (
          <>
            {selectedEntry.title && (
              <h3 className="preview-title">{selectedEntry.title}</h3>
            )}
            <p className="preview-snippet">
              "{selectedEntry.content.slice(0, 180)}
              {selectedEntry.content.length > 180 ? '...' : ''}"
            </p>
            <button
              className="preview-action-btn"
              onClick={() => onSelectDate(selectedDateKey)}
            >
              <BookOpen size={16} />
              <span>Open Diary Page</span>
            </button>
          </>
        ) : (
          <>
            <p className="preview-empty-text">
              No diary entry written for this day yet.
            </p>
            <button
              className="preview-action-btn secondary"
              onClick={() => onSelectDate(selectedDateKey)}
            >
              <PenLine size={16} />
              <span>Start Writing for this Day</span>
            </button>
          </>
        )}
      </section>
    </div>
  );
}
