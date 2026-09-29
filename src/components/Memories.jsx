import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  Heart,
  Sparkles,
  BookOpen,
  Calendar as CalendarIcon,
  Clock
} from 'lucide-react';
import {
  getOnThisDayMemories,
  getFavouriteEntries,
  getAllEntries,
  searchEntries
} from '../database/diaryStore';
import '../styles/memories.css';

export default function Memories({ onSelectDate }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [onThisDayList, setOnThisDayList] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load memories data on mount
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);
      try {
        const [flashbacks, favs, all] = await Promise.all([
          getOnThisDayMemories(),
          getFavouriteEntries(),
          getAllEntries()
        ]);

        if (!isCancelled) {
          setOnThisDayList(flashbacks);
          setFavourites(favs);
          setRecentEntries(all.slice(0, 10)); // Top 10 most recent
        }
      } catch (err) {
        console.error('Failed to load memories:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchEntries(searchQuery);
      setSearchResults(results);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Format date helper
  const formatDateDisplay = (dateKey) => {
    if (!dateKey) return '';
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Calculate year difference for "On this day"
  const getYearsAgoLabel = (dateKey) => {
    const entryYear = Number(dateKey.split('-')[0]);
    const currentYear = new Date().getFullYear();
    const diff = currentYear - entryYear;
    if (diff === 1) return '1 year ago today';
    if (diff > 1) return `${diff} years ago today`;
    return 'Past reflection';
  };

  return (
    <div className="memories-container">
      {/* Header & Local Search */}
      <header className="memories-header">
        <div className="memories-title-group">
          <h2>Memories & Reflections</h2>
          <p className="memories-subtitle">
            Revisit your moments, rediscover your words, and reflect on the journey.
          </p>
        </div>

        <div className="search-box-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="memories-search-input"
            placeholder="Search diary thoughts, memories, feelings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search diary"
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* 1. Search Results Section (Shown when search is active) */}
      {isSearching && (
        <section className="memory-section" aria-label="Search results">
          <h3 className="memory-section-title">
            <Search size={15} />
            <span>Search Results ({searchResults.length})</span>
          </h3>

          {searchResults.length > 0 ? (
            <div className="memories-grid">
              {searchResults.map((entry) => (
                <article
                  key={entry.id}
                  className="memory-item-card"
                  onClick={() => onSelectDate(entry.date)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelectDate(entry.date);
                  }}
                >
                  <div className="memory-card-header">
                    <span className="memory-card-date">
                      {formatDateDisplay(entry.date)}
                    </span>
                    <div className="memory-card-meta">
                      {entry.favourite && (
                        <Heart size={14} fill="#e05d5d" color="#e05d5d" />
                      )}
                      {entry.mood && <span>{entry.mood}</span>}
                    </div>
                  </div>
                  {entry.title && (
                    <h4 className="memory-card-title">{entry.title}</h4>
                  )}
                  {entry.content && (
                    <p className="memory-card-excerpt">{entry.content}</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="memory-empty-box">
              No diary entries match "{searchQuery}".
            </div>
          )}
        </section>
      )}

      {/* 2. "On This Day" Flashbacks (Shown when not searching) */}
      {!isSearching && (
        <section className="memory-section" aria-label="On this day">
          <h3 className="memory-section-title">
            <Sparkles size={15} />
            <span>On This Day</span>
          </h3>

          {onThisDayList.length > 0 ? (
            <div className="memories-grid">
              {onThisDayList.map((entry) => (
                <div key={entry.id} className="flashback-card">
                  <span className="flashback-badge">
                    {getYearsAgoLabel(entry.date)}
                  </span>
                  <div className="flashback-date">
                    {formatDateDisplay(entry.date)}
                  </div>
                  {entry.title && (
                    <h4 className="memory-card-title">{entry.title}</h4>
                  )}
                  <blockquote className="flashback-quote">
                    "{entry.content.slice(0, 200)}
                    {entry.content.length > 200 ? '...' : ''}"
                  </blockquote>
                  <button
                    className="preview-action-btn"
                    onClick={() => onSelectDate(entry.date)}
                  >
                    <BookOpen size={16} />
                    <span>Revisit this Day</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="memory-empty-box">
              No entries written on this day in past years yet. As time passes, your
              historical reflections will appear here.
            </div>
          )}
        </section>
      )}

      {/* 3. Favourite Moments (Shown when not searching) */}
      {!isSearching && (
        <section className="memory-section" aria-label="Favourite memories">
          <h3 className="memory-section-title">
            <Heart size={15} fill="#e05d5d" color="#e05d5d" />
            <span>Favourite Memories ({favourites.length})</span>
          </h3>

          {favourites.length > 0 ? (
            <div className="memories-grid">
              {favourites.map((entry) => (
                <article
                  key={entry.id}
                  className="memory-item-card"
                  onClick={() => onSelectDate(entry.date)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelectDate(entry.date);
                  }}
                >
                  <div className="memory-card-header">
                    <span className="memory-card-date">
                      {formatDateDisplay(entry.date)}
                    </span>
                    <div className="memory-card-meta">
                      {entry.mood && <span>{entry.mood}</span>}
                      <Heart size={14} fill="#e05d5d" color="#e05d5d" />
                    </div>
                  </div>
                  {entry.title && (
                    <h4 className="memory-card-title">{entry.title}</h4>
                  )}
                  {entry.content && (
                    <p className="memory-card-excerpt">{entry.content}</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="memory-empty-box">
              You haven't marked any entries as favourites yet. Tap the heart icon
              on any diary entry to keep it close here.
            </div>
          )}
        </section>
      )}

      {/* 4. Recent Reflections Stream */}
      {!isSearching && recentEntries.length > 0 && (
        <section className="memory-section" aria-label="Recent reflections">
          <h3 className="memory-section-title">
            <Clock size={15} />
            <span>Recent Reflections</span>
          </h3>

          <div className="memories-grid">
            {recentEntries.map((entry) => (
              <article
                key={entry.id}
                className="memory-item-card"
                onClick={() => onSelectDate(entry.date)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectDate(entry.date);
                }}
              >
                <div className="memory-card-header">
                  <span className="memory-card-date">
                    {formatDateDisplay(entry.date)}
                  </span>
                  <div className="memory-card-meta">
                    {entry.favourite && (
                      <Heart size={14} fill="#e05d5d" color="#e05d5d" />
                    )}
                    {entry.mood && <span>{entry.mood}</span>}
                  </div>
                </div>
                {entry.title && (
                  <h4 className="memory-card-title">{entry.title}</h4>
                )}
                {entry.content && (
                  <p className="memory-card-excerpt">{entry.content}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
