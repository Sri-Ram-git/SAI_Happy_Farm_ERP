interface DateFilterProps {
  days: number;
  onChange: (days: number) => void;
}

const OPTIONS = [
  { value: 1, label: 'Today' },
  { value: 7, label: 'Last 7 Days' },
  { value: 30, label: 'Last 30 Days' },
  { value: 90, label: 'Last 90 Days' },
];

export function DateFilter({ days, onChange }: DateFilterProps) {
  return (
    <div className="mgmt-date-filter">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`mgmt-date-pill ${days === opt.value ? 'mgmt-date-pill--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
