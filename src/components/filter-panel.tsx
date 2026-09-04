"use client";

import { ChevronDown, RotateCcw, X } from "lucide-react";

type FilterPanelProps = {
  categories: string[];
  formats: string[];
  sellingAngles: string[];
  languages: string[];
  category: string;
  format: string;
  sellingAngle: string;
  language: string;
  activeCount: number;
  resultCount: number;
  mobile?: boolean;
  onCategoryChange: (value: string) => void;
  onFormatChange: (value: string) => void;
  onSellingAngleChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onClear: () => void;
  onClose?: () => void;
};

function FilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-field">
      <span className="filter-field__label">{label}</span>
      <span className="filter-field__control">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {values.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <ChevronDown aria-hidden="true" size={15} strokeWidth={1.8} />
      </span>
    </label>
  );
}

export function FilterPanel(props: FilterPanelProps) {
  return (
    <div className="filter-panel">
      <div className="filter-panel__header">
        <div>
          <h2>Filters</h2>
          <p>{props.activeCount ? `${props.activeCount} active` : "All approved ads"}</p>
        </div>
        {props.mobile && (
          <button className="icon-control" type="button" onClick={props.onClose} aria-label="Close filters" autoFocus>
            <X aria-hidden="true" size={18} />
          </button>
        )}
      </div>

      <div className="filter-panel__fields">
        <FilterSelect label="Category" value={props.category} values={props.categories} onChange={props.onCategoryChange} />
        <FilterSelect label="Creative format" value={props.format} values={props.formats} onChange={props.onFormatChange} />
        <FilterSelect label="Message angle" value={props.sellingAngle} values={props.sellingAngles} onChange={props.onSellingAngleChange} />
        <FilterSelect label="Language" value={props.language} values={props.languages} onChange={props.onLanguageChange} />
      </div>

      {props.activeCount > 0 && (
        <button className="filter-panel__reset" type="button" onClick={props.onClear}>
          <RotateCcw aria-hidden="true" size={14} /> Reset filters
        </button>
      )}

      {props.mobile && (
        <button className="filter-panel__apply" type="button" onClick={props.onClose}>
          Show {props.resultCount} ad{props.resultCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
