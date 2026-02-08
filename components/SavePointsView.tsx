
import React, { useState, useEffect, useCallback } from 'react';
import { BusinessProfile, Appointment, Client, Expense, ClientRating, BonusEntry } from '../types';
import { createSavePoint, listSavePoints, getSavePoint, deleteSavePoint, SavePointMeta } from '../services/apiService';
import { createSnapshot, migrateSnapshot, SNAPSHOT_VERSION, AppSnapshot } from '../services/snapshotMigration';
import { getDeviceFingerprint } from '../services/deviceFingerprint';
import { Save, Download, Trash2, Monitor, Smartphone, Tablet, Clock, AlertTriangle, CheckCircle, XCircle, Plus, RefreshCw, HardDrive, Tag, X } from 'lucide-react';

interface SavePointsViewProps {
  // Current app state (to serialize into snapshots)
  businessProfile: BusinessProfile;
  clients: Client[];
  appointments: Appointment[];
  expenses: Expense[];
  ratings: ClientRating[];
  bonusEntries: BonusEntry[];
  // Callback to restore state from a snapshot
  onRestore: (snapshot: AppSnapshot) => void;
  isAuthenticated: boolean;
}

const SavePointsView: React.FC<SavePointsViewProps> = ({
  businessProfile,
  clients,
  appointments,
  expenses,
  ratings,
  bonusEntries,
  onRestore,
  isAuthenticated
}) => {
  const [savePoints, setSavePoints] = useState<SavePointMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Label input for new save point
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  // Confirm restore modal
  const [confirmRestore, setConfirmRestore] = useState<SavePointMeta | null>(null);

  // Confirm delete modal
  const [confirmDelete, setConfirmDelete] = useState<SavePointMeta | null>(null);

  // Fetch save points on mount
  const fetchSavePoints = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);

    const result = await listSavePoints();
    if (result.error) {
      if (result.error === 'API_UNAVAILABLE') {
        setError('Backend not available. Save Points require a backend connection.');
      } else {
        setError(result.error);
      }
    } else if (result.data) {
      setSavePoints(result.data);
    }
    setIsLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSavePoints();
  }, [fetchSavePoints]);

  // Auto-hide success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Create save point
  const handleCreate = async () => {
    const label = newLabel.trim() || `Save Point - ${new Date().toLocaleString()}`;
    setIsCreating(true);
    setError(null);

    const snapshot = createSnapshot({
      businessProfile,
      clients,
      appointments,
      expenses,
      ratings,
      bonusEntries,
    });

    const result = await createSavePoint(label, snapshot, SNAPSHOT_VERSION);
    if (result.error) {
      setError(result.error === 'API_UNAVAILABLE'
        ? 'Backend not available. Cannot create save point.'
        : result.error);
    } else {
      setSuccess(`Save point "${label}" created successfully!`);
      setShowLabelInput(false);
      setNewLabel('');
      await fetchSavePoints();
    }
    setIsCreating(false);
  };

  // Load / restore save point
  const handleRestore = async (sp: SavePointMeta) => {
    setIsRestoring(sp.id);
    setError(null);

    const result = await getSavePoint(sp.id);
    if (result.error) {
      setError(result.error);
      setIsRestoring(null);
      setConfirmRestore(null);
      return;
    }

    if (result.data && result.data.snapshot_json) {
      let snapshot = result.data.snapshot_json as AppSnapshot;

      // Run migration if version mismatch
      if (snapshot.version !== SNAPSHOT_VERSION) {
        snapshot = migrateSnapshot(snapshot);
      }

      onRestore(snapshot);
      setSuccess(`Loaded save point "${sp.label}" successfully! Your local state has been replaced.`);
    } else {
      setError('Save point data is empty or corrupted.');
    }

    setIsRestoring(null);
    setConfirmRestore(null);
  };

  // Delete save point
  const handleDelete = async (sp: SavePointMeta) => {
    setError(null);
    const result = await deleteSavePoint(sp.id);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(`Deleted save point "${sp.label}".`);
      setSavePoints(prev => prev.filter(s => s.id !== sp.id));
    }
    setConfirmDelete(null);
  };

  // Device icon
  const DeviceIcon = ({ type }: { type: string }) => {
    if (type === 'mobile') return <Smartphone className="w-4 h-4" />;
    if (type === 'tablet') return <Tablet className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  // Current device info for display
  const fingerprint = getDeviceFingerprint();
  const currentDeviceShort = fingerprint.slice(0, 8);

  if (!isAuthenticated) {
    return (
      <div className="p-8 max-w-4xl mx-auto pb-20">
        <div className="text-center py-20">
          <HardDrive className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-3">Save Points</h2>
          <p className="text-zinc-500 mb-6">Sign in to use Save Points and sync your data across devices.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto pb-20">
      <header className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-3">
              <HardDrive className="w-7 h-7 sm:w-8 sm:h-8 text-orange-600" />
              Save Points
            </h1>
            <p className="text-zinc-500 text-sm">
              Create snapshots of your data and load them on any device. Like video game saves — manual, reliable, cross-device.
            </p>
          </div>
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <Monitor className="w-3 h-3" />
            <span className="font-mono">Device: {currentDeviceShort}…</span>
          </div>
        </div>
      </header>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800 flex items-start gap-3 animate-in fade-in duration-200">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm font-bold uppercase tracking-wider">Error</p>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-900/20 border border-emerald-800 flex items-start gap-3 animate-in fade-in duration-200">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-emerald-300 text-sm">{success}</p>
        </div>
      )}

      {/* Create Save Point */}
      <div className="mb-8">
        {!showLabelInput ? (
          <button
            onClick={() => setShowLabelInput(true)}
            disabled={isCreating}
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-orange-600 text-black px-8 py-4 font-bold uppercase tracking-widest text-sm hover:bg-white transition-colors shadow-lg disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            Create Save Point
          </button>
        ) : (
          <div className="bg-zinc-900 border border-zinc-700 p-6 animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-orange-600" />
              New Save Point
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Optional label (e.g. 'Before price changes')"
                className="flex-1 bg-black border border-zinc-700 p-3 text-white focus:border-orange-600 outline-none text-sm"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-600 text-black px-6 py-3 font-bold uppercase tracking-widest text-xs hover:bg-white transition-colors disabled:opacity-50"
                >
                  {isCreating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isCreating ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowLabelInput(false); setNewLabel(''); }}
                  className="px-4 py-3 bg-zinc-800 text-zinc-400 font-bold uppercase tracking-widest text-xs hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Current state summary */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: 'Appointments', count: appointments.length },
                { label: 'Clients', count: clients.length },
                { label: 'Expenses', count: expenses.length },
                { label: 'Bonuses', count: bonusEntries.length },
                { label: 'Ratings', count: ratings.length },
              ].map(item => (
                <div key={item.label} className="bg-black border border-zinc-800 p-2 text-center">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">{item.label}</p>
                  <p className="text-white font-mono font-bold">{item.count}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save Points List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
            Your Save Points
          </h2>
          <button
            onClick={fetchSavePoints}
            disabled={isLoading}
            className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoading && savePoints.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-zinc-600 animate-spin mx-auto mb-3" />
            <p className="text-zinc-500 text-sm uppercase tracking-wider">Loading save points...</p>
          </div>
        ) : savePoints.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-700">
            <HardDrive className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm uppercase tracking-wider mb-2">No save points yet</p>
            <p className="text-zinc-600 text-xs">Create your first save point to snapshot your current data.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savePoints.map((sp) => (
              <div
                key={sp.id}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all group"
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold text-sm uppercase tracking-wide truncate">
                        {sp.label}
                      </h3>
                      <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                        v{sp.snapshot_version}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(sp.created_at)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <DeviceIcon type={sp.device_type} />
                        <span className={`uppercase tracking-wider font-bold ${
                          sp.device_type === 'mobile' ? 'text-blue-400' 
                          : sp.device_type === 'tablet' ? 'text-purple-400' 
                          : 'text-zinc-400'
                        }`}>
                          {sp.device_name || sp.device_type}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmRestore(sp)}
                      disabled={isRestoring === sp.id}
                      className="flex items-center gap-2 bg-emerald-900/30 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-400 hover:text-emerald-300 px-4 py-2 font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
                    >
                      {isRestoring === sp.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      Load
                    </button>
                    <button
                      onClick={() => setConfirmDelete(sp)}
                      className="flex items-center gap-2 bg-zinc-800 hover:bg-red-900/30 border border-zinc-700 hover:border-red-800 text-zinc-500 hover:text-red-400 px-3 py-2 font-bold uppercase tracking-widest text-xs transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Architecture Info */}
      <div className="mt-12 p-6 bg-zinc-900/50 border border-zinc-800 text-zinc-500 text-xs">
        <h4 className="font-bold text-zinc-400 uppercase tracking-wider mb-2">How Save Points Work</h4>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong className="text-zinc-300">Create:</strong> Snapshots your entire current state (appointments, clients, expenses, etc.) and uploads it to the server.</li>
          <li><strong className="text-zinc-300">Load:</strong> Downloads a snapshot from the server and <em>replaces</em> your local working state. This is not a merge — it's a full replacement.</li>
          <li><strong className="text-zinc-300">Cross-device:</strong> Save on desktop, load on mobile (or vice versa). Same account, different devices.</li>
          <li><strong className="text-zinc-300">Manual sync:</strong> Nothing happens automatically. You decide when to save and when to load.</li>
        </ul>
      </div>

      {/* Confirm Restore Modal */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-700 w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-900/30 border border-amber-800 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-bold text-white uppercase tracking-wider">Load Save Point?</h3>
              </div>
              <p className="text-zinc-400 text-sm">
                Loading <strong className="text-white">"{confirmRestore.label}"</strong> will <strong className="text-amber-400">replace all your current local data</strong> with this snapshot.
              </p>
              <p className="text-zinc-500 text-xs mt-2">
                Created {formatDate(confirmRestore.created_at)} on {confirmRestore.device_name} ({confirmRestore.device_type})
              </p>
            </div>
            <div className="p-4 flex gap-3">
              <button
                onClick={() => setConfirmRestore(null)}
                className="flex-1 py-3 border border-zinc-700 text-zinc-400 font-bold uppercase tracking-widest text-xs hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(confirmRestore)}
                disabled={isRestoring !== null}
                className="flex-1 py-3 bg-amber-600 text-black font-bold uppercase tracking-widest text-xs hover:bg-amber-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isRestoring ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isRestoring ? 'Loading...' : 'Replace & Load'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-700 w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-zinc-800">
              <h3 className="font-bold text-white uppercase tracking-wider mb-2">Delete Save Point?</h3>
              <p className="text-zinc-400 text-sm">
                Permanently delete <strong className="text-white">"{confirmDelete.label}"</strong>? This cannot be undone.
              </p>
            </div>
            <div className="p-4 flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 border border-zinc-700 text-zinc-400 font-bold uppercase tracking-widest text-xs hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-3 bg-red-600 text-white font-bold uppercase tracking-widest text-xs hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavePointsView;
