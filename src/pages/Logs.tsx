import { useState, useEffect, useCallback } from 'react';
import { getActivityLogs } from '../services/firebase';
import type { ActivityLog } from '../types';

const ACTION_ICONS: Record<string, string> = {
  TEAMS_GENERATED: '[GEN]',
  TEAMS_SWAPPED: '[SWP]',
  TEAMS_TWEAKED: '[TWK]',
  MATCH_SAVED: '[SAV]',
  RESULT_SAVED: '[RES]',
  MATCH_DELETED: '[DEL]',
  PLAYER_CREATED: '[NEW]',
  PLAYER_UPDATED: '[UPD]',
  PLAYER_DELETED: '[DEL]',
  PLAYER_ARCHIVED: '[ARC]',
  PLAYER_UNARCHIVED: '[UNA]',
  AVAILABILITY_CHANGED: '[AVL]',
  AVAILABILITY_RESET: '[RST]',
};

const ACTION_COLORS: Record<string, string> = {
  TEAMS_GENERATED: 'log-action-gen',
  TEAMS_SWAPPED: 'log-action-swp',
  TEAMS_TWEAKED: 'log-action-twk',
  MATCH_SAVED: 'log-action-sav',
  RESULT_SAVED: 'log-action-res',
  MATCH_DELETED: 'log-action-del',
  PLAYER_CREATED: 'log-action-new',
  PLAYER_UPDATED: 'log-action-upd',
  PLAYER_DELETED: 'log-action-del',
  PLAYER_ARCHIVED: 'log-action-arc',
  PLAYER_UNARCHIVED: 'log-action-una',
  AVAILABILITY_CHANGED: 'log-action-avl',
  AVAILABILITY_RESET: 'log-action-rst',
};

export function Logs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logLimit, setLogLimit] = useState(100);
  const [filter, setFilter] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getActivityLogs(logLimit);
      setLogs(data);
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setLoading(false);
    }
  }, [logLimit]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const filteredLogs = filter
    ? logs.filter(
        (log) =>
          log.action.toLowerCase().includes(filter.toLowerCase()) ||
          log.details.toLowerCase().includes(filter.toLowerCase()) ||
          log.ipAddress.includes(filter)
      )
    : logs;

  return (
    <div className="logs-page">
      <div className="logs-terminal">
        <div className="terminal-header">
          <div className="terminal-dots">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <span className="terminal-title">ossmnf-admin-logs ~ bash</span>
        </div>
        <div className="terminal-toolbar">
          <input
            type="text"
            className="terminal-filter"
            placeholder="grep ..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className="terminal-select"
            value={logLimit}
            onChange={(e) => setLogLimit(Number(e.target.value))}
          >
            <option value={50}>tail -50</option>
            <option value={100}>tail -100</option>
            <option value={250}>tail -250</option>
            <option value={500}>tail -500</option>
          </select>
          <button className="terminal-btn" onClick={loadLogs}>
            refresh
          </button>
        </div>
        <div className="terminal-body">
          {loading ? (
            <div className="terminal-line">
              <span className="log-prompt">$</span>
              <span className="log-loading">fetching logs from firestore...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="terminal-line">
              <span className="log-prompt">$</span>
              <span className="log-empty">
                {filter ? `no results matching "${filter}"` : 'no logs found — actions will appear here'}
              </span>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="terminal-line">
                <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
                <span className="log-ip">{log.ipAddress}</span>
                <span className={`log-action ${ACTION_COLORS[log.action] || ''}`}>
                  {ACTION_ICONS[log.action] || `[${log.action}]`}
                </span>
                <span className="log-details">{log.details}</span>
              </div>
            ))
          )}
          <div className="terminal-line terminal-cursor">
            <span className="log-prompt">$</span>
            <span className="cursor-blink">_</span>
          </div>
        </div>
      </div>
    </div>
  );
}
