import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Bell, Check, X, GitCommit, Award, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

export function NotificationDrawer({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const markAsRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'github': return <GitCommit size={16} className="text-cyan-400" style={{ color: '#38bdf8' }} />;
      case 'milestone': return <Award size={16} className="text-emerald-400" style={{ color: '#10b981' }} />;
      case 'evaluation': return <CheckCircle2 size={16} className="text-violet-400" style={{ color: '#a78bfa' }} />;
      case 'task': return <Clock size={16} className="text-amber-400" style={{ color: '#f59e0b' }} />;
      case 'announcement': return <ShieldAlert size={16} style={{ color: '#a78bfa' }} />;
      default: return <Bell size={16} className="text-slate-400" />;
    }
  };

  const formatTime = (iso) => {
    if (!iso) return 'Just now';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '100%',
      maxWidth: '420px',
      height: '100vh',
      backgroundColor: 'rgba(11, 17, 30, 0.98)',
      backdropFilter: 'blur(20px)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)',
      animation: 'slideIn 0.25s ease-out'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            padding: '8px',
            borderRadius: '8px',
            background: 'rgba(56, 189, 248, 0.1)',
            color: '#38bdf8'
          }}>
            <Bell size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>Activity & Notifications</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Real-time microservice events</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={markAllRead}
            className="btn btn-secondary btn-sm"
            title="Mark all as read"
          >
            <Check size={14} /> Read all
          </button>
          <button onClick={onClose} className="btn-icon" style={{ borderRadius: '50%' }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>Loading updates...</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <Bell size={32} style={{ margin: '0 auto 12px auto', opacity: 0.3 }} />
            <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>No notifications yet</p>
            <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Events from GitHub and evaluations will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notifications.map((item) => (
              <div
                key={item._id}
                onClick={() => !item.read && markAsRead(item._id)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: item.read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(56, 189, 248, 0.06)',
                  border: `1px solid ${item.read ? 'rgba(255, 255, 255, 0.05)' : 'rgba(56, 189, 248, 0.25)'}`,
                  cursor: item.read ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {!item.read && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#38bdf8'
                  }} />
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ marginTop: '2px' }}>{getIcon(item.type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: item.read ? '#e2e8f0' : '#fff' }}>
                        {item.title}
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                      {item.message}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '0.7rem', color: '#64748b' }}>
                      <Clock size={12} />
                      <span>{formatTime(item.createdAt)}</span>
                      <span>•</span>
                      <span style={{ textTransform: 'capitalize' }}>{item.type}</span>
                      {item.branchName && <><span>•</span><span>{item.branchName}</span></>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
