import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

interface Case {
  id: number;
  case_number: string;
  case_type: string;
  status: string;
  created_at: string;
}

interface SearchResult {
  cases: Case[];
  identifiers: any[];
  suspects: any[];
}

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const queryFromUrl = searchParams.get('q');
    if (queryFromUrl) {
      setSearchQuery(queryFromUrl);
      performSearch(queryFromUrl);
    }
  }, [searchParams]);

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    setSearching(true);
    setHasSearched(true);

    try {
      const searchResults = await window.electronAPI.searchCases(query.trim());
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;

    // Update URL with query parameter
    setSearchParams({ q: searchQuery.trim() });
    performSearch(searchQuery);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: '🟢 Open',
      warrants_issued: '🟡 Warrants Issued',
      ready_residential: '🔵 Ready for Residential',
      arrest: '🔴 Arrested',
      closed_no_arrest: '⚫ Closed',
      referred: '🔵 Transferred',
    };
    return labels[status] || status;
  };

  const getCaseTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cybertip: '🛡️ CyberTip',
      p2p: '🔗 Peer 2 Peer',
      chat: '💬 Chat',
      other: '📋 Other',
    };
    return labels[type] || type;
  };

  const totalResults = (results?.cases?.length || 0) + 
                       (results?.identifiers?.length || 0) + 
                       (results?.suspects?.length || 0);

  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">Search Cases</h1>
          <p className="text-text-muted">Search by case number, IP address, email, username, suspect name, or any identifier</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter case number, IP address, email, suspect name..."
                className="w-full px-4 py-3 pl-12 bg-panel border border-accent-cyan/30 rounded-lg 
                         text-text-primary placeholder-text-muted
                         focus:outline-none focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20"
                autoFocus
              />
              <svg 
                className="w-5 h-5 text-text-muted absolute left-4 top-1/2 -translate-y-1/2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              type="submit"
              disabled={!searchQuery.trim() || searching}
              className="px-6 py-3 bg-accent-cyan text-background rounded-lg font-medium
                       hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
            >
              {searching ? (
                <>
                  <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </>
              )}
            </button>
          </div>
        </form>

        {/* Results */}
        {hasSearched && !searching && (
          <div>
            {totalResults === 0 ? (
              <div className="bg-panel border border-accent-cyan/20 rounded-lg p-12 text-center">
                <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-text-muted text-lg">No results found for "{searchQuery}"</p>
                <p className="text-text-muted text-sm mt-2">Try different search terms or check spelling</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Results Summary */}
                <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-4">
                  <p className="text-text-primary font-medium">
                    Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{searchQuery}"
                  </p>
                </div>

                {/* Cases Results */}
                {results?.cases && results.cases.length > 0 && (
                  <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-text-primary mb-4">
                      Cases ({results.cases.length})
                    </h2>
                    <div className="space-y-3">
                      {results.cases.map((caseItem) => (
                        <Link
                          key={caseItem.id}
                          to={`/cases/${caseItem.id}`}
                          className="block bg-background rounded-lg p-4 border border-accent-cyan/20 
                                   hover:border-accent-cyan/50 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className="text-2xl">{getCaseTypeLabel(caseItem.case_type).split(' ')[0]}</span>
                              <div>
                                <p className="text-text-primary font-medium">{caseItem.case_number}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-text-muted">{getCaseTypeLabel(caseItem.case_type)}</span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan">
                                    {getStatusLabel(caseItem.status)}
                                  </span>
                                  <span className="text-xs text-text-muted">
                                    {new Date(caseItem.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Identifiers Results */}
                {results?.identifiers && results.identifiers.length > 0 && (
                  <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-text-primary mb-4">
                      Identifiers ({results.identifiers.length})
                    </h2>
                    <div className="space-y-3">
                      {results.identifiers.map((identifier: any) => (
                        <Link
                          key={identifier.id}
                          to={`/cases/${identifier.case_id}`}
                          className="block bg-background rounded-lg p-4 border border-accent-cyan/20 
                                   hover:border-accent-cyan/50 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-text-primary font-medium">{identifier.identifier_value}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-text-muted uppercase">{identifier.identifier_type}</span>
                                {identifier.platform && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan">
                                    {identifier.platform}
                                  </span>
                                )}
                                {identifier.provider && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan">
                                    {identifier.provider}
                                  </span>
                                )}
                                <span className="text-xs text-text-muted">Case: {identifier.case_number}</span>
                              </div>
                            </div>
                            <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suspects Results */}
                {results?.suspects && results.suspects.length > 0 && (
                  <div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-text-primary mb-4">
                      Suspects ({results.suspects.length})
                    </h2>
                    <div className="space-y-3">
                      {results.suspects.map((suspect: any) => (
                        <Link
                          key={suspect.id}
                          to={`/cases/${suspect.case_id}?tab=suspect`}
                          className="block bg-background rounded-lg p-4 border border-accent-cyan/20 
                                   hover:border-accent-cyan/50 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-text-primary font-medium">
                                {suspect.first_name} {suspect.last_name}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                {suspect.dob && (
                                  <span className="text-xs text-text-muted">DOB: {suspect.dob}</span>
                                )}
                                {suspect.phone && (
                                  <span className="text-xs text-text-muted">Phone: {suspect.phone}</span>
                                )}
                                <span className="text-xs text-text-muted">Case: {suspect.case_number}</span>
                              </div>
                            </div>
                            <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
