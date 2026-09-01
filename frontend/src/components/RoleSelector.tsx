type Role = 'farmer' | 'supervisor' | 'admin';

interface Props {
  selected: Role;
  onChange: (role: Role) => void;
}

const roles: { key: Role; label: string }[] = [
  { key: 'farmer', label: 'Farmer' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'admin', label: 'Admin' },
];

export function RoleSelector({ selected, onChange }: Props) {
  return (
    <div className="role-selector">
      {roles.map((r) => (
        <button
          key={r.key}
          type="button"
          className={`role-btn ${selected === r.key ? 'role-btn--active' : ''}`}
          onClick={() => onChange(r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
