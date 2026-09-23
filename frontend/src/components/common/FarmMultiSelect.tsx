import React, { useState, useRef, useEffect } from 'react';
import type { FarmDoc } from '../../services/farmDataService';

export interface FarmMultiSelectProps {
  farms: FarmDoc[];
  selectedFarmIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
}

export const FarmMultiSelect: React.FC<FarmMultiSelectProps> = ({
  farms,
  selectedFarmIds,
  onChange,
  disabled = false,
  error,
  label = 'Assign Farms (Select Multiple)',
  required = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleFarm = (farmId: string) => {
    if (disabled) return;
    if (selectedFarmIds.includes(farmId)) {
      onChange(selectedFarmIds.filter((id) => id !== farmId));
    } else {
      onChange([...selectedFarmIds, farmId]);
    }
  };

  const removeFarm = (farmId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedFarmIds.filter((id) => id !== farmId));
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const filteredIds = filteredFarms.map((f) => f.farmId);
    const combined = Array.from(new Set([...selectedFarmIds, ...filteredIds]));
    onChange(combined);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (searchQuery.trim()) {
      const filteredIds = new Set(filteredFarms.map((f) => f.farmId));
      onChange(selectedFarmIds.filter((id) => !filteredIds.has(id)));
    } else {
      onChange([]);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredFarms = farms.filter(
    (f) =>
      (f.farmId && f.farmId.toLowerCase().includes(q)) ||
      (f.name && f.name.toLowerCase().includes(q))
  );

  // Map selected farm IDs to farm objects for chip rendering
  const selectedFarmsList = selectedFarmIds.map((id) => {
    const found = farms.find((f) => f.farmId === id);
    return {
      farmId: id,
      name: found?.name || id,
    };
  });

  return (
    <div className="farm-multi-select-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#374151', fontSize: 14 }}>
          {label} {required && '*'}
        </label>
      )}

      {/* Selected Farms Chips Container */}
      {selectedFarmsList.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 8,
            maxHeight: 110,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {selectedFarmsList.map((f) => (
            <span
              key={f.farmId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#047857',
                padding: '3px 10px',
                borderRadius: 16,
                fontSize: 13,
                fontWeight: 500,
                lineHeight: 1.4,
              }}
              title={f.name !== f.farmId ? `${f.farmId} (${f.name})` : f.farmId}
            >
              <span>
                <strong>{f.farmId}</strong>
                {f.name && f.name !== f.farmId ? ` - ${f.name}` : ''}
              </span>
              <button
                type="button"
                onClick={(e) => removeFarm(f.farmId, e)}
                disabled={disabled}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#047857',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: 14,
                  padding: 0,
                  marginLeft: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
                aria-label={`Remove farm ${f.farmId}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown Trigger Box */}
      <div
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          backgroundColor: disabled ? '#f3f4f6' : '#ffffff',
          border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
          borderRadius: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 14,
          userSelect: 'none',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          transition: 'border-color 0.15s ease',
        }}
      >
        <span style={{ color: selectedFarmIds.length === 0 ? '#9ca3af' : '#111827', fontWeight: selectedFarmIds.length === 0 ? 400 : 500 }}>
          {selectedFarmIds.length === 0
            ? 'Select farms...'
            : `${selectedFarmIds.length} farm${selectedFarmIds.length > 1 ? 's' : ''} selected`}
        </span>
        <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {/* Error Message */}
      {error && <div className="field-error" style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{error}</div>}

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {/* Search Header */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#ffffff' }}>
            <input
              type="text"
              placeholder="🔍 Search farms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Action Buttons: Select All / Clear All */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 12px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              fontSize: 13,
            }}
          >
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={disabled || filteredFarms.length === 0}
              style={{
                background: 'none',
                border: 'none',
                color: '#16a34a',
                cursor: disabled || filteredFarms.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                padding: 0,
              }}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={disabled || selectedFarmIds.length === 0}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                cursor: disabled || selectedFarmIds.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                padding: 0,
              }}
            >
              Clear All
            </button>
          </div>

          {/* Scrollable Farm List */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filteredFarms.length === 0 ? (
              <div style={{ padding: '16px 12px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                No farms found matching "{searchQuery}"
              </div>
            ) : (
              filteredFarms.map((f) => {
                const isChecked = selectedFarmIds.includes(f.farmId);
                return (
                  <div
                    key={f.farmId}
                    onClick={() => toggleFarm(f.farmId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      backgroundColor: isChecked ? '#f0fdf4' : '#ffffff',
                      borderBottom: '1px solid #f3f4f6',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by container onClick
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#16a34a' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{f.farmId}</div>
                      {f.name && f.name !== f.farmId && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{f.name}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
