import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  MessageSquare, RefreshCw, Send, Search, Check, CheckCheck,
  ArrowLeft, Sparkles
} from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../api/client';
import { useAuth } from '../context/AuthContext';
import './Messages.css';

interface StaffContact {
  id: string;
  name: string;
  username: string;
  role: string;
  department: string;
  role_title?: string;
  roleTitle?: string;
}

interface UserMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_name: string;
  recipient_name: string;
  sender_role?: string;
  sender_role_title?: string;
  recipient_role?: string;
  recipient_role_title?: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#2563eb',
  receptionist: '#0284c7',
  opd: '#10b981',
  emergency: '#ef4444',
  pharmacy: '#8b5cf6',
  laboratory: '#f59e0b',
};

const QUICK_TEMPLATES = [
  '📋 Patient card dispatched to OPD',
  '🚨 Urgent clinical consultation requested',
  '💊 Prescription ready for pickup at dispensary',
  '🧪 Lab results completed and attached to EMR',
  '✅ Patient has been attended and discharged',
  '📞 Please call back or review encounter file',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatMessageTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatChatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

function formatSnippetTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export default function Messages() {
  const { currentUser, token } = useAuth();
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [activeContactId, setActiveContactId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [directory, inbox] = await Promise.all([
        apiGet<{ data: StaffContact[] }>('/auth/directory', token),
        apiGet<{ data: UserMessage[] }>('/messages', token),
      ]);
      setContacts(directory.data || []);
      setMessages(inbox.data || []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sync messages.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
    const interval = window.setInterval(loadData, 10_000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  // Group messages per contact & calculate unread counts and last message
  const chatSummaries = useMemo(() => {
    const map = new Map<string, { lastMessage: UserMessage | null; unreadCount: number }>();

    for (const c of contacts) {
      map.set(c.id, { lastMessage: null, unreadCount: 0 });
    }

    for (const m of messages) {
      const partnerId = m.sender_id === currentUser?.id ? m.recipient_id : m.sender_id;
      const entry = map.get(partnerId) || { lastMessage: null, unreadCount: 0 };

      if (!entry.lastMessage || new Date(m.created_at) > new Date(entry.lastMessage.created_at)) {
        entry.lastMessage = m;
      }

      if (m.recipient_id === currentUser?.id && !m.read_at) {
        entry.unreadCount += 1;
      }

      map.set(partnerId, entry);
    }

    return map;
  }, [contacts, messages, currentUser?.id]);

  // Filter contacts by search and active tab
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        contact.name.toLowerCase().includes(q) ||
        contact.username.toLowerCase().includes(q) ||
        contact.department.toLowerCase().includes(q) ||
        (contact.role_title || contact.role).toLowerCase().includes(q);

      if (!matchSearch) return false;

      const summary = chatSummaries.get(contact.id);
      if (activeTab === 'unread') return (summary?.unreadCount || 0) > 0;
      if (activeTab === 'clinical') return contact.role === 'opd' || contact.role === 'emergency';
      if (activeTab === 'reception') return contact.role === 'receptionist';
      if (activeTab === 'pharmacy') return contact.role === 'pharmacy';
      if (activeTab === 'lab') return contact.role === 'laboratory';
      if (activeTab === 'admin') return contact.role === 'admin';

      return true;
    }).sort((a, b) => {
      // Sort by recent message time, then unread, then name
      const sumA = chatSummaries.get(a.id);
      const sumB = chatSummaries.get(b.id);
      const timeA = sumA?.lastMessage ? new Date(sumA.lastMessage.created_at).getTime() : 0;
      const timeB = sumB?.lastMessage ? new Date(sumB.lastMessage.created_at).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      if ((sumB?.unreadCount || 0) !== (sumA?.unreadCount || 0)) {
        return (sumB?.unreadCount || 0) - (sumA?.unreadCount || 0);
      }
      return a.name.localeCompare(b.name);
    });
  }, [contacts, search, activeTab, chatSummaries]);

  // Messages in active conversation
  const activeMessages = useMemo(() => {
    if (!activeContactId) return [];
    return messages
      .filter(m => (m.sender_id === activeContactId && m.recipient_id === currentUser?.id) ||
                   (m.sender_id === currentUser?.id && m.recipient_id === activeContactId))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, activeContactId, currentUser?.id]);

  // Mark messages in active conversation as read
  useEffect(() => {
    if (!activeContactId || !currentUser?.id || !token) return;
    const unreadFromContact = activeMessages.filter(
      m => m.recipient_id === currentUser.id && !m.read_at
    );
    if (!unreadFromContact.length) return;

    // Use fast read-all endpoint
    apiPatch(`/messages/read-all/${encodeURIComponent(activeContactId)}`, {}, token)
      .then(() => {
        setMessages(prev => prev.map(m =>
          m.sender_id === activeContactId && m.recipient_id === currentUser.id
            ? { ...m, read_at: new Date().toISOString() }
            : m
        ));
      })
      .catch(() => {});
  }, [activeContactId, activeMessages, currentUser?.id, token]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, activeContactId]);

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const text = body.trim();
    if (!activeContactId || !text || sending || !token) return;

    setSending(true);
    setError('');
    try {
      const res = await apiPost<{ data: UserMessage }>('/messages', {
        recipientId: activeContactId,
        body: text,
      }, token);

      if (res.data) {
        setMessages(prev => [...prev, res.data]);
      }
      setBody('');
      if (textareaRef.current) textareaRef.current.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const activeContact = contacts.find(c => c.id === activeContactId);
  const totalUnreadAll = useMemo(() => {
    return messages.filter(m => m.recipient_id === currentUser?.id && !m.read_at).length;
  }, [messages, currentUser?.id]);

  // Group active messages by date
  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; items: UserMessage[] }> = [];
    let currentDate = '';
    let currentGroup: UserMessage[] = [];

    for (const m of activeMessages) {
      const messageDate = formatChatDate(m.created_at);
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, items: currentGroup });
        }
        currentDate = messageDate;
        currentGroup = [m];
      } else {
        currentGroup.push(m);
      }
    }

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, items: currentGroup });
    }

    return groups;
  }, [activeMessages]);

  return (
    <div className="tg-page-container">
      {/* Telegram App Container */}
      <div className="tg-app">
        {/* Left Sidebar */}
        <div className={`tg-sidebar ${activeContactId ? 'hidden-mobile' : ''}`}>
          {/* Header & Search */}
          <div className="tg-sidebar-header">
            <div className="tg-search-box">
              <Search size={16} className="tg-search-icon" />
              <input
                type="text"
                className="tg-search-input"
                placeholder="Search staff, doctor, role…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="tg-filter-tabs">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread', count: totalUnreadAll },
              { id: 'clinical', label: 'Doctors' },
              { id: 'reception', label: 'Reception' },
              { id: 'pharmacy', label: 'Pharmacy' },
              { id: 'lab', label: 'Lab' },
              { id: 'admin', label: 'Admin' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`tg-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {Boolean(tab.count) && <span className="tg-tab-count">{tab.count}</span>}
              </button>
            ))}
          </div>

          {/* Chat List */}
          <ul className="tg-chat-list">
            {filteredContacts.length === 0 ? (
              <li style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--clr-text-muted)' }}>
                <p style={{ margin: 0, fontSize: '0.86rem' }}>No staff contacts found</p>
              </li>
            ) : (
              filteredContacts.map(contact => {
                const summary = chatSummaries.get(contact.id);
                const lastMsg = summary?.lastMessage;
                const unread = summary?.unreadCount || 0;
                const isSelected = contact.id === activeContactId;
                const avatarBg = ROLE_COLORS[contact.role] || '#2563eb';

                return (
                  <li
                    key={contact.id}
                    className={`tg-chat-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setActiveContactId(contact.id)}
                  >
                    <div className="tg-avatar-wrap">
                      <div className="tg-avatar" style={{ backgroundColor: avatarBg }}>
                        {getInitials(contact.name)}
                      </div>
                      <span className="tg-online-dot" title="Staff active" />
                    </div>

                    <div className="tg-item-info">
                      <div className="tg-item-top">
                        <span className="tg-contact-name">{contact.name}</span>
                        {lastMsg && (
                          <span className="tg-item-time">{formatSnippetTime(lastMsg.created_at)}</span>
                        )}
                      </div>

                      <div className="tg-item-bottom">
                        <span className={`tg-last-snippet ${unread > 0 ? 'unread' : ''}`}>
                          {lastMsg ? (
                            <>
                              {lastMsg.sender_id === currentUser?.id && (
                                <span style={{ marginRight: 3, verticalAlign: 'middle', display: 'inline-flex' }}>
                                  {lastMsg.read_at ? <CheckCheck size={13} color="#2563eb" /> : <Check size={13} />}
                                </span>
                              )}
                              {lastMsg.body}
                            </>
                          ) : (
                            <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
                              {contact.role_title || contact.role} · {contact.department}
                            </span>
                          )}
                        </span>

                        {unread > 0 && (
                          <span className="tg-unread-badge">{unread}</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Right Chat Main */}
        <div className={`tg-chat-main ${!activeContactId ? 'hidden-mobile' : ''}`}>
          {activeContact ? (
            <>
              {/* Active Chat Header */}
              <div className="tg-chat-header">
                <div className="tg-chat-header-user">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-icon d-md-none"
                    onClick={() => setActiveContactId('')}
                    title="Back to chats"
                    aria-label="Back"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  <div className="tg-avatar-wrap">
                    <div className="tg-avatar" style={{ backgroundColor: ROLE_COLORS[activeContact.role] || '#2563eb', width: 40, height: 40, fontSize: '0.88rem' }}>
                      {getInitials(activeContact.name)}
                    </div>
                    <span className="tg-online-dot" />
                  </div>

                  <div>
                    <h2 className="tg-header-title">
                      {activeContact.name}
                      <span className="badge badge-gray" style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                        {activeContact.role_title || activeContact.role}
                      </span>
                    </h2>
                    <p className="tg-header-subtitle">
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                      Online · {activeContact.department}
                    </p>
                  </div>
                </div>

                <div className="tg-header-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void loadData()}
                    title="Sync conversation"
                  >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    <span className="d-none d-sm-inline ms-1">Sync</span>
                  </button>
                </div>
              </div>

              {/* Chat Messages Stream */}
              <div className="tg-messages-thread" aria-live="polite">
                {error && (
                  <div className="alert alert-danger py-2 px-3 mx-auto" style={{ maxWidth: 480 }} role="alert">
                    {error}
                  </div>
                )}

                {activeMessages.length === 0 ? (
                  <div className="tg-empty-chat" style={{ padding: '30px 10px' }}>
                    <div className="tg-empty-icon" style={{ width: 60, height: 60 }}>
                      <Sparkles size={28} />
                    </div>
                    <div className="tg-empty-title" style={{ fontSize: '1.05rem' }}>Start conversation</div>
                    <div className="tg-empty-desc">
                      Send a secure clinic message to {activeContact.name}. History is encrypted and recorded in the audit trail.
                    </div>
                  </div>
                ) : (
                  groupedMessages.map(group => (
                    <div key={group.date} className="tg-date-group">
                      <div className="tg-date-divider">{group.date}</div>
                      {group.items.map(m => {
                        const isOwn = m.sender_id === currentUser?.id;
                        return (
                          <div
                            key={m.id}
                            className={`tg-bubble-wrap ${isOwn ? 'outgoing' : 'incoming'}`}
                          >
                            <div className={`tg-bubble ${isOwn ? 'outgoing' : 'incoming'}`}>
                              {!isOwn && (
                                <div className="tg-bubble-sender">
                                  {m.sender_name}
                                  {m.sender_role && (
                                    <span style={{ fontSize: '0.66rem', opacity: 0.75, fontWeight: 500 }}>
                                      ({m.sender_role})
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="tg-bubble-text">{m.body}</div>
                              <div className="tg-bubble-meta">
                                <span>{formatMessageTime(m.created_at)}</span>
                                {isOwn && (
                                  <span title={m.read_at ? `Read at ${new Date(m.read_at).toLocaleTimeString()}` : 'Delivered'}>
                                    {m.read_at ? (
                                      <CheckCheck size={14} color="#ffffff" />
                                    ) : (
                                      <Check size={14} />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Template Chips */}
              <div className="tg-quick-replies">
                {QUICK_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="tg-quick-chip"
                    onClick={() => setBody(tmpl)}
                  >
                    {tmpl}
                  </button>
                ))}
              </div>

              {/* Message Composer */}
              <form className="tg-composer" onSubmit={handleSendMessage}>
                <textarea
                  ref={textareaRef}
                  className="tg-composer-input"
                  rows={1}
                  maxLength={2000}
                  placeholder={`Write a message to ${activeContact.name}… (Enter to send, Shift+Enter for new line)`}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  required
                />
                <button
                  type="submit"
                  className="tg-send-btn"
                  disabled={sending || !body.trim()}
                  title="Send message (Enter)"
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            /* No conversation selected empty placeholder */
            <div className="tg-empty-chat">
              <div className="tg-empty-icon">
                <MessageSquare size={38} />
              </div>
              <div className="tg-empty-title">BruClinic Messenger</div>
              <div className="tg-empty-desc">
                Select a colleague from the staff directory on the left to review chat history or send a secure operational message.
              </div>
              <div className="tg-quick-contact-pills">
                {contacts.slice(0, 5).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className="tg-quick-contact-btn"
                    onClick={() => setActiveContactId(c.id)}
                  >
                    💬 {c.name} ({c.roleTitle || c.role})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
