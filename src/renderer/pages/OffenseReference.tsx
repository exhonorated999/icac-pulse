import { useState, useEffect } from 'react';

interface Offense {
  id: number;
  charge_code: string;
  charge_description: string;
  seriousness: string;
  sentencing_range: string | null;
  notes: string | null;
  category: 'state' | 'federal';
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function OffenseReference() {
  const [offenses, setOffenses] = useState<Offense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedOffense, setSelectedOffense] = useState<Offense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'state' | 'federal'>('state');
  const [formData, setFormData] = useState({
    chargeCode: '',
    chargeDescription: '',
    seriousness: '',
    sentencingRange: '',
    notes: '',
    category: 'state' as 'state' | 'federal'
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    loadOffenses();
  }, []);

  const loadOffenses = async () => {
    try {
      const data = await window.electronAPI.getAllOffenses();
      console.log('Loaded offenses from DB:', data);
      console.log('Number of offenses:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('First offense:', data[0]);
        console.log('Categories:', data.map(o => o.category));
      }
      setOffenses(data || []);
    } catch (error) {
      console.error('Failed to load offenses:', error);
      alert(`Failed to load offenses: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOffense = async () => {
    if (!formData.chargeCode.trim()) {
      alert('Please enter a charge code');
      return;
    }

    if (!formData.chargeDescription.trim()) {
      alert('Please enter a charge description');
      return;
    }

    if (!formData.seriousness) {
      alert('Please select seriousness level');
      return;
    }

    try {
      const offenseData = {
        chargeCode: formData.chargeCode,
        chargeDescription: formData.chargeDescription,
        seriousness: formData.seriousness,
        sentencingRange: formData.sentencingRange || null,
        notes: formData.notes || null,
        category: formData.category
      };
      
      console.log('Sending offense data:', offenseData);
      const result = await window.electronAPI.addOffense(offenseData);
      console.log('Add offense result:', result);

      await loadOffenses();
      setShowAddDialog(false);
      setFormData({
        chargeCode: '',
        chargeDescription: '',
        seriousness: '',
        sentencingRange: '',
        notes: '',
        category: 'state'
      });
      
      alert('Offense added successfully!');
    } catch (error) {
      console.error('Failed to add offense:', error);
      alert(`Failed to add offense: ${error}`);
    }
  };

  const handleEditOffense = async () => {
    if (!selectedOffense) return;

    if (!formData.chargeCode.trim()) {
      alert('Please enter a charge code');
      return;
    }

    if (!formData.chargeDescription.trim()) {
      alert('Please enter a charge description');
      return;
    }

    if (!formData.seriousness) {
      alert('Please select seriousness level');
      return;
    }

    try {
      await window.electronAPI.updateOffense(selectedOffense.id, {
        chargeCode: formData.chargeCode,
        chargeDescription: formData.chargeDescription,
        seriousness: formData.seriousness,
        sentencingRange: formData.sentencingRange || null,
        notes: formData.notes || null,
        category: formData.category
      });

      await loadOffenses();
      setShowEditDialog(false);
      setSelectedOffense(null);
      setFormData({
        chargeCode: '',
        chargeDescription: '',
        seriousness: '',
        sentencingRange: '',
        notes: '',
        category: 'state'
      });
    } catch (error) {
      console.error('Failed to update offense:', error);
      alert(`Failed to update offense: ${error}`);
    }
  };

  const handleDeleteOffense = async (offense: Offense) => {
    if (!confirm(`Delete offense "${offense.charge_code}"?`)) {
      return;
    }

    try {
      await window.electronAPI.deleteOffense(offense.id);
      await loadOffenses();
    } catch (error) {
      console.error('Failed to delete offense:', error);
      alert(`Failed to delete offense: ${error}`);
    }
  };

  const openEditDialog = (offense: Offense) => {
    setSelectedOffense(offense);
    setFormData({
      chargeCode: offense.charge_code,
      chargeDescription: offense.charge_description,
      seriousness: offense.seriousness,
      sentencingRange: offense.sentencing_range || '',
      notes: offense.notes || '',
      category: offense.category || 'state'
    });
    setShowEditDialog(true);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOffenses = [...offenses];
    const draggedItem = newOffenses[draggedIndex];
    newOffenses.splice(draggedIndex, 1);
    newOffenses.splice(index, 0, draggedItem);

    setOffenses(newOffenses);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    try {
      // Save new order to database
      const offenseIds = offenses.map(o => o.id);
      await window.electronAPI.reorderOffenses(offenseIds);
      setDraggedIndex(null);
    } catch (error) {
      console.error('Failed to reorder offenses:', error);
      alert(`Failed to save new order: ${error}`);
      // Reload to restore correct order
      await loadOffenses();
    }
  };

  const getSeriousnessColor = (seriousness: string) => {
    switch (seriousness.toLowerCase()) {
      case 'felony':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'misdemeanor':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'infraction':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'wobbler':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const handleExport = async () => {
    try {
      const result = await window.electronAPI.exportOffenses();
      
      if (result.canceled) return;
      
      if (result.success) {
        alert(`Successfully exported ${result.count} offense references to:\n${result.filePath}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error}`);
    }
  };

  const handleImport = async (overwriteDuplicates: boolean) => {
    try {
      const result = await window.electronAPI.importOffenses({ overwriteDuplicates });
      
      if (result.canceled) {
        setShowImportDialog(false);
        return;
      }
      
      if (result.success) {
        await loadOffenses();
        setShowImportDialog(false);
        
        let message = `Import completed successfully!\n\n`;
        message += `✅ Imported: ${result.imported} new offenses\n`;
        if (result.updated > 0) {
          message += `🔄 Updated: ${result.updated} existing offenses\n`;
        }
        if (result.skipped > 0) {
          message += `⏭️ Skipped: ${result.skipped} duplicates\n`;
        }
        
        alert(message);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Import failed: ${error}`);
      setShowImportDialog(false);
    }
  };

  // Filter offenses based on search query and active tab
  const filteredOffenses = offenses.filter(offense => {
    console.log('Filtering offense:', offense.charge_code, 'category:', offense.category, 'activeTab:', activeTab);
    // Filter by category (tab)
    if (offense.category !== activeTab) {
      console.log('  -> Filtered out due to category mismatch');
      return false;
    }
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      offense.charge_code.toLowerCase().includes(query) ||
      offense.charge_description.toLowerCase().includes(query) ||
      offense.seriousness.toLowerCase().includes(query) ||
      (offense.sentencing_range && offense.sentencing_range.toLowerCase().includes(query)) ||
      (offense.notes && offense.notes.toLowerCase().includes(query))
    );
  });
  
  console.log('Total offenses:', offenses.length, 'Filtered offenses:', filteredOffenses.length, 'Active tab:', activeTab);

  // Highlight matching text in search results
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-accent-cyan/30 text-text-primary rounded px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-text-primary text-xl">Loading offenses...</div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-text-primary mb-2">Offense Reference</h1>
            <p className="text-text-muted">Quick reference for charges, sentencing, and jury instructions</p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="px-6 py-3 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg font-medium
                       hover:border-accent-cyan transition-colors flex items-center gap-2"
              title="Export all offenses to JSON file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export
            </button>
            
            <button
              onClick={() => setShowImportDialog(true)}
              className="px-6 py-3 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg font-medium
                       hover:border-accent-cyan transition-colors flex items-center gap-2"
              title="Import offenses from JSON file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L9 8m4-4v12"/>
              </svg>
              Import
            </button>
            
            <button
              onClick={() => setShowAddDialog(true)}
              className="px-6 py-3 bg-accent-cyan text-background rounded-lg font-medium
                       hover:bg-accent-cyan/90 transition-colors flex items-center gap-2 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add Offense
            </button>
          </div>
        </div>

        {/* State/Federal Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('state')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'state'
                ? 'bg-accent-cyan text-background shadow-lg'
                : 'bg-panel border border-accent-cyan/30 text-text-primary hover:border-accent-cyan'
            }`}
          >
            🏛️ State Offenses
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'state' ? 'bg-background/20' : 'bg-accent-cyan/20'
            }`}>
              {offenses.filter(o => o.category === 'state').length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('federal')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'federal'
                ? 'bg-accent-cyan text-background shadow-lg'
                : 'bg-panel border border-accent-cyan/30 text-text-primary hover:border-accent-cyan'
            }`}
          >
            🦅 Federal Offenses
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'federal' ? 'bg-background/20' : 'bg-accent-cyan/20'
            }`}>
              {offenses.filter(o => o.category === 'federal').length}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-2xl">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by charge code, keyword, or phrase (e.g., 'manufacture', 'hidden camera', 'PC 311')..."
              className="w-full px-4 py-3 pl-12 bg-panel border border-accent-cyan/30 rounded-lg
                       text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan
                       focus:ring-2 focus:ring-accent-cyan/20"
            />
            <svg 
              className="w-5 h-5 text-text-muted absolute left-4 top-1/2 -translate-y-1/2"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary
                         transition-colors p-1"
                title="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-text-muted">
              Found {filteredOffenses.length} offense{filteredOffenses.length !== 1 ? 's' : ''} matching "{searchQuery}"
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="mb-6 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-accent-cyan flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div className="text-sm text-text-muted">
              <p className="font-medium text-text-primary mb-1">Drag to Reorder</p>
              <p>Click and drag any offense to reorder the list. Group related offenses together for easier reference.</p>
            </div>
          </div>
        </div>

        {/* Offenses List */}
        {offenses.length === 0 ? (
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-12 text-center">
            <svg className="w-16 h-16 text-accent-cyan/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <h3 className="text-xl font-semibold text-text-primary mb-2">No Offenses Yet</h3>
            <p className="text-text-muted mb-4">Add your first offense to build your reference library</p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="px-6 py-2 bg-accent-cyan text-background rounded-lg font-medium
                       hover:bg-accent-cyan/90 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add Your First Offense
            </button>
          </div>
        ) : filteredOffenses.length === 0 ? (
          <div className="bg-panel border border-accent-cyan/20 rounded-lg p-12 text-center">
            <svg className="w-16 h-16 text-text-muted/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <h3 className="text-xl font-semibold text-text-primary mb-2">No Results Found</h3>
            <p className="text-text-muted mb-4">No offenses match "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-6 py-2 bg-accent-cyan text-background rounded-lg font-medium
                       hover:bg-accent-cyan/90 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Clear Search
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOffenses.map((offense, index) => (
              <div
                key={offense.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="bg-panel border border-accent-cyan/20 rounded-lg p-6 hover:border-accent-cyan/50 
                         transition-colors cursor-move group"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Drag Handle */}
                  <div className="text-text-muted group-hover:text-accent-cyan transition-colors pt-1">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M4 8h16M4 16h16"/>
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    {/* Charge Code and Seriousness */}
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-text-primary">
                        {searchQuery ? highlightText(offense.charge_code, searchQuery) : offense.charge_code}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeriousnessColor(offense.seriousness)}`}>
                        {offense.seriousness}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-text-primary mb-3 leading-relaxed">
                      {searchQuery ? highlightText(offense.charge_description, searchQuery) : offense.charge_description}
                    </p>

                    {/* Sentencing Range */}
                    {offense.sentencing_range && (
                      <div className="mb-3">
                        <span className="text-sm font-medium text-text-muted">Sentencing Range: </span>
                        <span className="text-sm text-text-primary">
                          {searchQuery ? highlightText(offense.sentencing_range, searchQuery) : offense.sentencing_range}
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {offense.notes && (
                      <div className="bg-background rounded-lg p-4 border border-accent-cyan/20">
                        <p className="text-sm font-medium text-text-muted mb-2">Additional Notes:</p>
                        <p className="text-sm text-text-primary whitespace-pre-wrap">
                          {searchQuery ? highlightText(offense.notes, searchQuery) : offense.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditDialog(offense)}
                      className="px-3 py-2 bg-background border border-accent-cyan/30 text-accent-cyan rounded-lg
                               hover:border-accent-cyan transition-colors"
                      title="Edit offense"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteOffense(offense)}
                      className="px-3 py-2 bg-background border border-accent-pink/30 text-accent-pink rounded-lg
                               hover:border-accent-pink transition-colors"
                      title="Delete offense"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Offense Dialog */}
        {showAddDialog && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-panel border border-accent-cyan rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-text-primary mb-6">Add Offense</h3>

              <div className="space-y-4">
                {/* Charge Code */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Charge Code <span className="text-accent-pink">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.chargeCode}
                    onChange={(e) => setFormData({ ...formData, chargeCode: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                    placeholder="e.g., PC 311.11(a)"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Category <span className="text-accent-pink">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as 'state' | 'federal' })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                  >
                    <option value="state">🏛️ State</option>
                    <option value="federal">🦅 Federal</option>
                  </select>
                </div>

                {/* Seriousness */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Seriousness <span className="text-accent-pink">*</span>
                  </label>
                  <select
                    value={formData.seriousness}
                    onChange={(e) => setFormData({ ...formData, seriousness: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                  >
                    <option value="">Select seriousness...</option>
                    <option value="Felony">Felony</option>
                    <option value="Misdemeanor">Misdemeanor</option>
                    <option value="Wobbler">Wobbler</option>
                    <option value="Infraction">Infraction</option>
                  </select>
                </div>

                {/* Charge Description */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Charge Description <span className="text-accent-pink">*</span>
                  </label>
                  <textarea
                    value={formData.chargeDescription}
                    onChange={(e) => setFormData({ ...formData, chargeDescription: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan resize-none"
                    placeholder="Full description of the charge..."
                  />
                </div>

                {/* Sentencing Range */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Sentencing Range (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.sentencingRange}
                    onChange={(e) => setFormData({ ...formData, sentencingRange: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                    placeholder="e.g., 2, 3, or 4 years"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan resize-none"
                    placeholder="Jury instructions, case law, additional information..."
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setFormData({
                      chargeCode: '',
                      chargeDescription: '',
                      seriousness: '',
                      sentencingRange: '',
                      notes: '',
                      category: 'state'
                    });
                  }}
                  className="flex-1 px-4 py-3 bg-background border border-accent-cyan/30 text-text-primary rounded-lg font-medium
                           hover:border-accent-cyan transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddOffense}
                  className="flex-1 px-4 py-3 bg-accent-cyan text-background rounded-lg font-medium
                           hover:bg-accent-cyan/90 transition-colors"
                >
                  Add Offense
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Options Dialog */}
        {showImportDialog && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-panel border border-accent-cyan rounded-xl p-8 max-w-lg w-full">
              <h3 className="text-2xl font-bold text-text-primary mb-6">Import Offenses</h3>

              <div className="mb-6 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-accent-cyan flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div className="text-sm text-text-muted">
                    <p className="font-medium text-text-primary mb-1">Duplicate Detection</p>
                    <p>Duplicates are detected by matching <strong>charge code + category</strong>. Choose how to handle them:</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleImport(false)}
                  className="w-full px-6 py-4 bg-background border border-accent-cyan/30 rounded-lg text-left
                           hover:border-accent-cyan transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⏭️</div>
                    <div className="flex-1">
                      <div className="font-medium text-text-primary mb-1">Skip Duplicates</div>
                      <div className="text-sm text-text-muted">Keep your existing offenses. Only import new ones that don't already exist.</div>
                    </div>
                    <svg className="w-5 h-5 text-accent-cyan opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                </button>

                <button
                  onClick={() => handleImport(true)}
                  className="w-full px-6 py-4 bg-background border border-accent-cyan/30 rounded-lg text-left
                           hover:border-accent-cyan transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🔄</div>
                    <div className="flex-1">
                      <div className="font-medium text-text-primary mb-1">Overwrite Duplicates</div>
                      <div className="text-sm text-text-muted">Replace existing offenses with imported versions. Use this to update your reference library.</div>
                    </div>
                    <svg className="w-5 h-5 text-accent-cyan opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" 
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowImportDialog(false)}
                className="w-full px-4 py-3 bg-background border border-accent-cyan/30 text-text-primary rounded-lg font-medium
                         hover:border-accent-cyan transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Edit Offense Dialog */}
        {showEditDialog && selectedOffense && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-panel border border-accent-cyan rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-text-primary mb-6">Edit Offense</h3>

              <div className="space-y-4">
                {/* Charge Code */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Charge Code <span className="text-accent-pink">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.chargeCode}
                    onChange={(e) => setFormData({ ...formData, chargeCode: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Category <span className="text-accent-pink">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as 'state' | 'federal' })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                  >
                    <option value="state">🏛️ State</option>
                    <option value="federal">🦅 Federal</option>
                  </select>
                </div>

                {/* Seriousness */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Seriousness <span className="text-accent-pink">*</span>
                  </label>
                  <select
                    value={formData.seriousness}
                    onChange={(e) => setFormData({ ...formData, seriousness: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                  >
                    <option value="">Select seriousness...</option>
                    <option value="Felony">Felony</option>
                    <option value="Misdemeanor">Misdemeanor</option>
                    <option value="Wobbler">Wobbler</option>
                    <option value="Infraction">Infraction</option>
                  </select>
                </div>

                {/* Charge Description */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Charge Description <span className="text-accent-pink">*</span>
                  </label>
                  <textarea
                    value={formData.chargeDescription}
                    onChange={(e) => setFormData({ ...formData, chargeDescription: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan resize-none"
                  />
                </div>

                {/* Sentencing Range */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Sentencing Range (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.sentencingRange}
                    onChange={(e) => setFormData({ ...formData, sentencingRange: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2 bg-background border border-accent-cyan/30 rounded-lg
                             text-text-primary focus:outline-none focus:border-accent-cyan resize-none"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedOffense(null);
                    setFormData({
                      chargeCode: '',
                      chargeDescription: '',
                      seriousness: '',
                      sentencingRange: '',
                      notes: '',
                      category: 'state'
                    });
                  }}
                  className="flex-1 px-4 py-3 bg-background border border-accent-cyan/30 text-text-primary rounded-lg font-medium
                           hover:border-accent-cyan transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditOffense}
                  className="flex-1 px-4 py-3 bg-accent-cyan text-background rounded-lg font-medium
                           hover:bg-accent-cyan/90 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
