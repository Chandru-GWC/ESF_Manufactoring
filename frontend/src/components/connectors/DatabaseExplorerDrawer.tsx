import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Database,
  Table,
  Columns,
  Search,
  RefreshCw,
  Eye,
  Key,
  ShieldAlert,
  Loader2,
  Filter,
  Play,
  Layers,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  ConnectorResponse,
  DatabaseMetadata,
  TableMetadata,
  CollectionMetadata,
  DataPreviewResponse,
} from '../../types/ehs';

interface DatabaseExplorerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  connector: ConnectorResponse | null;
}

export const DatabaseExplorerDrawer: React.FC<DatabaseExplorerDrawerProps> = ({
  isOpen,
  onClose,
  connector,
}) => {
  const [metadata, setMetadata] = useState<DatabaseMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableMetadata | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<CollectionMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<'schema' | 'preview'>('schema');

  // Preview state
  const [previewData, setPreviewData] = useState<DataPreviewResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [filterClause, setFilterClause] = useState('');
  const [limit, setLimit] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && connector) {
      loadMetadata(false);
    } else {
      setMetadata(null);
      setSelectedTable(null);
      setSelectedCollection(null);
      setPreviewData(null);
      setErrorMsg(null);
    }
  }, [isOpen, connector?.connector_id]);

  const loadMetadata = async (forceRefresh = false) => {
    if (!connector) return;
    setIsLoadingMetadata(true);
    setErrorMsg(null);
    try {
      const data = await api.getConnectorMetadata(connector.connector_id, forceRefresh);
      setMetadata(data);
      if (data.tables && data.tables.length > 0) {
        setSelectedTable(data.tables[0]);
        setSelectedCollection(null);
      } else if (data.collections && data.collections.length > 0) {
        setSelectedCollection(data.collections[0]);
        setSelectedTable(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to discover database metadata.');
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const loadPreview = async (targetName: string, schemaName?: string | null) => {
    if (!connector) return;
    setIsLoadingPreview(true);
    setErrorMsg(null);
    try {
      const res = await api.previewConnectorData(connector.connector_id, {
        target: targetName,
        schema_name: schemaName || undefined,
        filter_clause: filterClause.trim() || undefined,
        limit,
      });
      setPreviewData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Data preview failed.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'preview' && (selectedTable || selectedCollection)) {
      const target = selectedTable ? selectedTable.name : selectedCollection!.name;
      const schema = selectedTable?.schema_name;
      loadPreview(target, schema);
    }
  }, [activeTab, selectedTable?.name, selectedCollection?.name, limit]);

  if (!isOpen || !connector) return null;

  const filteredTables = (metadata?.tables || []).filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCollections = (metadata?.collections || []).filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Rendered on <body> so a transformed page container cannot offset the full-screen overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{connector.name}</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-blue-100 text-blue-700">
                  {connector.db_type}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-100 text-emerald-700">
                  Read-Only Enforced
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Destination: {connector.host ? `${connector.host}:${connector.port}` : connector.database_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadMetadata(true)}
              disabled={isLoadingMetadata}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMetadata ? 'animate-spin' : ''}`} />
              Refresh Schemas
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body 2-Pane Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Object Tree */}
          <div className="w-72 border-r border-slate-100 bg-slate-50/50 flex flex-col">
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter tables & collections..."
                  className="w-full text-xs pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoadingMetadata && (
                <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span>Discovering database catalog...</span>
                </div>
              )}

              {!isLoadingMetadata && filteredTables.length === 0 && filteredCollections.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  No tables or collections discovered.
                </div>
              )}

              {/* SQL Tables */}
              {filteredTables.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Table className="w-3 h-3" /> Tables ({filteredTables.length})
                  </div>
                  {filteredTables.map((t) => {
                    const isSelected = selectedTable?.name === t.name;
                    return (
                      <button
                        key={t.name}
                        onClick={() => {
                          setSelectedTable(t);
                          setSelectedCollection(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{t.name}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {t.columns.length} cols
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* NoSQL Collections */}
              {filteredCollections.length > 0 && (
                <div className="mt-3">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Collections ({filteredCollections.length})
                  </div>
                  {filteredCollections.map((c) => {
                    const isSelected = selectedCollection?.name === c.name;
                    return (
                      <button
                        key={c.name}
                        onClick={() => {
                          setSelectedCollection(c);
                          setSelectedTable(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {c.sample_fields.length} fields
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Pane: Table Definition & Preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* View Tabs */}
            <div className="px-6 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  onClick={() => setActiveTab('schema')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === 'schema'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5 inline mr-1" />
                  Schema Definition
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === 'preview'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 inline mr-1" />
                  Safe Data Preview
                </button>
              </div>

              {activeTab === 'preview' && previewData && (
                <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                  <span>Latency: {previewData.execution_time_ms} ms</span>
                  <span className="text-slate-300">|</span>
                  <span>{previewData.rows.length} rows</span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tab 1: Schema View */}
            {activeTab === 'schema' && (
              <div className="flex-1 overflow-y-auto p-6">
                {selectedTable && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{selectedTable.name}</h3>
                        <p className="text-xs text-slate-500">
                          Schema: {selectedTable.schema_name || 'default'} • {selectedTable.columns.length} Columns
                        </p>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5">Column Name</th>
                            <th className="px-4 py-2.5">Data Type</th>
                            <th className="px-4 py-2.5 text-center">Primary Key</th>
                            <th className="px-4 py-2.5 text-center">Nullable</th>
                            <th className="px-4 py-2.5">Key Target</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedTable.columns.map((col) => (
                            <tr key={col.name} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2 font-mono font-semibold text-slate-900 flex items-center gap-1.5">
                                {col.is_primary_key && <Key className="w-3.5 h-3.5 text-amber-500" />}
                                {col.name}
                              </td>
                              <td className="px-4 py-2 font-mono text-slate-600">{col.data_type}</td>
                              <td className="px-4 py-2 text-center">
                                {col.is_primary_key ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                                    PK
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-4 py-2 text-center text-slate-500">
                                {col.is_nullable ? 'YES' : 'NO'}
                              </td>
                              <td className="px-4 py-2 text-slate-500 font-mono text-[11px]">
                                {col.foreign_key_target || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedCollection && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{selectedCollection.name}</h3>
                      <p className="text-xs text-slate-500">
                        Database: {selectedCollection.database_name} • Document Schema Sampling
                      </p>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5">Field Name</th>
                            <th className="px-4 py-2.5">Inferred BSON Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedCollection.sample_fields.map((field) => (
                            <tr key={field.name} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2 font-mono font-semibold text-slate-900">{field.name}</td>
                              <td className="px-4 py-2 font-mono text-slate-600">{field.data_type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Safe Data Preview */}
            {activeTab === 'preview' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Filter Toolbar */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={filterClause}
                      onChange={(e) => setFilterClause(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const target = selectedTable ? selectedTable.name : selectedCollection!.name;
                          const schema = selectedTable?.schema_name;
                          loadPreview(target, schema);
                        }
                      }}
                      placeholder="WHERE filter (e.g. status = 'ACTIVE' AND severity > 2)"
                      className="w-full text-xs pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <select
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value))}
                    className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value={10}>10 rows</option>
                    <option value={25}>25 rows</option>
                    <option value={50}>50 rows</option>
                  </select>

                  <button
                    onClick={() => {
                      const target = selectedTable ? selectedTable.name : selectedCollection!.name;
                      const schema = selectedTable?.schema_name;
                      loadPreview(target, schema);
                    }}
                    disabled={isLoadingPreview}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isLoadingPreview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Execute
                  </button>
                </div>

                {/* Table Preview Display */}
                <div className="flex-1 overflow-auto p-4">
                  {isLoadingPreview && (
                    <div className="h-64 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      <span>Fetching read-only sample records...</span>
                    </div>
                  )}

                  {!isLoadingPreview && previewData && previewData.rows.length === 0 && (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                      No matching records found.
                    </div>
                  )}

                  {!isLoadingPreview && previewData && previewData.rows.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm inline-block min-w-full">
                      <table className="w-full text-xs text-left divide-y divide-slate-200">
                        <thead className="bg-slate-50 font-bold text-slate-700">
                          <tr>
                            {previewData.columns.map((c) => (
                              <th key={c} className="px-3 py-2 whitespace-nowrap">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {previewData.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              {previewData.columns.map((c) => (
                                <td key={c} className="px-3 py-1.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                  {row[c] !== null && row[c] !== undefined ? String(row[c]) : '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
