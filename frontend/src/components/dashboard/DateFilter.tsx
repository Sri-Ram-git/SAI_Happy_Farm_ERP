interface DateFilterProps {
  days: number;
  onChange: (days: number) => void;
}

export function DateFilter({ days, onChange }: DateFilterProps) {
  const options = [
    { value: 1, label: 'Today' },
    { value: 7, label: '7 Days' },
    { value: 30, label: '30 Days' },
    { value: 90, label: '90 Days' },
  ];

  return (
    <div className="date-filter">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`date-filter-btn ${days === opt.value ? 'date-filter-btn--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
