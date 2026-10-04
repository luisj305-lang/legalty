'use client';

// Accessible, searchable multi-select for the case-creation participant fields.
// It keeps the native FormData contract: one hidden input per selected email, so
// `data.getAll(name)` still returns the exact newline-joined emails server-side.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Candidate } from '../../../../lib/cases/directory';
import { candidateLabel, filterCandidates, toggleSelection } from '../../../../lib/cases/selection';
import styles from '../cases.module.css';

const searchPlaceholder = 'Buscar…';
const noResultsText = 'Sin coincidencias.';

export function MultiSelect({ name, label, candidates, required = false, helpId, emptyText, disabled = false }: {
  name: string; label: string; candidates: Candidate[]; required?: boolean;
  helpId: string; emptyText: string; disabled?: boolean;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const listId = `${baseId}-list`;
  const emptyId = `${baseId}-empty`;
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const byEmail = useMemo(() => new Map(candidates.map(candidate => [candidate.email, candidate])), [candidates]);
  const filtered = useMemo(() => filterCandidates(candidates, query), [candidates, query]);
  const activeOption = open ? filtered[activeIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query, open]);

  function toggle(email: string) {
    if (disabled) return;
    setSelected(current => toggleSelection(current, email));
  }

  function remove(email: string) {
    if (disabled) return;
    setSelected(current => current.filter(item => item !== email));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) { setOpen(true); setActiveIndex(0); return; }
      if (filtered.length > 0) setActiveIndex(index => (index + 1) % filtered.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); setActiveIndex(Math.max(filtered.length - 1, 0)); return; }
      if (filtered.length > 0) setActiveIndex(index => (index - 1 + filtered.length) % filtered.length);
    } else if (event.key === 'Enter') {
      if (!open) { setOpen(true); return; }
      if (activeOption) { event.preventDefault(); toggle(activeOption.email); }
    } else if (event.key === 'Escape') {
      if (open) { event.preventDefault(); setOpen(false); }
    } else if (event.key === 'Backspace' && query === '' && selected.length > 0) {
      event.preventDefault();
      remove(selected[selected.length - 1]);
    }
  }

  if (candidates.length === 0) {
    return (
      <div className={styles.multiField}>
        <label>{label}</label>
        <p className={styles.multiEmpty} id={emptyId}>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className={styles.multiField}>
      <label id={labelId} htmlFor={baseId}>{label}</label>
      <div className={styles.multiControlBox} ref={containerRef}>
        <div className={`${styles.multiControl} ${disabled ? styles.multiControlDisabled : ''}`}
          onClick={() => { if (!disabled) { setOpen(true); searchRef.current?.focus(); } }}>
          {selected.map(email => {
            const candidate = byEmail.get(email);
            const text = candidate ? candidateLabel(candidate) : email;
            return (
              <span className={styles.multiChip} key={email}>
                <span className={styles.multiChipText}>{text}</span>
                <button type="button" className={styles.multiChipRemove} aria-label={`Quitar ${text}`}
                  disabled={disabled}
                  onClick={event => { event.stopPropagation(); remove(email); }}>×</button>
              </span>
            );
          })}
          <input ref={searchRef} id={baseId} type="search" role="combobox"
            className={styles.multiSearch} placeholder={searchPlaceholder} value={query}
            disabled={disabled}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-describedby={helpId}
            aria-required={required}
            aria-activedescendant={activeOption ? `${baseId}-option-${activeIndex}` : undefined}
            onChange={event => { setQuery(event.target.value); setOpen(true); }}
            onFocus={() => { if (!disabled) setOpen(true); }}
            onKeyDown={onKeyDown} />
        </div>
        {open && !disabled && (
          <ul className={styles.multiList} role="listbox" id={listId} aria-labelledby={labelId}>
            {filtered.length === 0
              ? <li className={styles.multiNoResults} role="presentation">{noResultsText}</li>
              : filtered.map((candidate, index) => {
                  const isSelected = selectedSet.has(candidate.email);
                  return (
                    <li key={candidate.id} id={`${baseId}-option-${index}`} role="option"
                      aria-selected={isSelected}
                      className={`${styles.multiOption} ${index === activeIndex ? styles.multiOptionActive : ''} ${isSelected ? styles.multiOptionSelected : ''}`}
                      onMouseDown={event => event.preventDefault()}
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={() => toggle(candidate.email)}>
                      <span className={styles.multiOptionCheck} aria-hidden="true">{isSelected ? '✓' : ''}</span>
                      <span className={styles.multiOptionLabel}>{candidateLabel(candidate)}</span>
                    </li>
                  );
                })}
          </ul>
        )}
      </div>
      {selected.map(email => <input key={email} type="hidden" name={name} value={email} />)}
    </div>
  );
}
