import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { MessageSquare, RefreshCw, Send } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface StaffContact { id: string; name: string; username: string; role: string; department: string; role_title?: string; roleTitle?: string; }
interface UserMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_name: string;
  recipient_name: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export default function Messages() {
  const { currentUser, token } = useAuth();
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [directory, inbox] = await Promise.all([
        apiGet<{ data: StaffContact[] }>('/auth/directory', token),
        apiGet<{ data: UserMessage[] }>('/messages', token),
      ]);
      setContacts(directory.data);
      setMessages(inbox.data);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => { void loadData(); }, 20_000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const visibleMessages = useMemo(() => messages
    .filter(message => message.sender_id === recipientId || message.recipient_id === recipientId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at)), [messages, recipientId]);

  useEffect(() => {
    if (!recipientId || !currentUser) return;
    const unread = visibleMessages.filter(message => message.recipient_id === currentUser.id && !message.read_at);
    if (!unread.length) return;
    Promise.all(unread.map(message => apiPatch(`/messages/${encodeURIComponent(message.id)}/read`, {}, token)))
      .then(() => loadData())
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not mark messages as read.'));
  }, [currentUser, loadData, recipientId, token, visibleMessages]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!recipientId || !text || sending) return;
    setSending(true);
    setError('');
    try {
      await apiPost('/messages', { recipientId, body: text }, token);
      setBody('');
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send this message.');
    } finally {
      setSending(false);
    }
  };

  const selectedContact = contacts.find(contact => contact.id === recipientId);
  return (
    <div className="container-fluid py-2">
      <header className="page-header mb-3">
        <div><h1 className="page-title"><MessageSquare size={24} /> Messages</h1><p className="page-subtitle">Private messages between active clinic staff.</p></div>
        <button type="button" className="btn btn-secondary" onClick={() => void loadData()}><RefreshCw size={15} /> Refresh</button>
      </header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="card">
        <div className="card-body">
          <label htmlFor="message-recipient" className="form-label">Staff member</label>
          <select id="message-recipient" className="form-select mb-3" value={recipientId} onChange={event => setRecipientId(event.target.value)}>
            <option value="">Choose a colleague…</option>
            {contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name} — {contact.roleTitle || contact.role}</option>)}
          </select>
          {recipientId ? (
            <>
              <div aria-live="polite" style={{ minHeight: 240, maxHeight: '55vh', overflowY: 'auto', border: '1px solid var(--clr-border)', borderRadius: 8, padding: 14, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loading && <p role="status">Loading messages…</p>}
                {!loading && visibleMessages.length === 0 && <p className="text-muted">No messages with {selectedContact?.name || 'this colleague'} yet.</p>}
                {visibleMessages.map(message => {
                  const own = message.sender_id === currentUser?.id;
                  return <div key={message.id} style={{ alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: 'min(85%, 620px)', background: own ? 'var(--clr-primary-500, #2563eb)' : 'var(--clr-bg-hover)', color: own ? '#fff' : 'var(--clr-text-primary)', borderRadius: 12, padding: '9px 12px' }}>
                    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.body}</div>
                    <small style={{ opacity: .8 }}>{own ? 'You' : message.sender_name} · {new Date(message.created_at).toLocaleString()}</small>
                  </div>;
                })}
              </div>
              <form onSubmit={submit} className="d-flex gap-2">
                <textarea className="form-control" rows={2} maxLength={2000} value={body} onChange={event => setBody(event.target.value)} placeholder={`Message ${selectedContact?.name || ''}`} aria-label="Message" required />
                <button className="btn btn-primary align-self-end" type="submit" disabled={sending || !body.trim()}><Send size={16} /> {sending ? 'Sending…' : 'Send'}</button>
              </form>
            </>
          ) : <p className="text-muted mb-0">Select a colleague to open a conversation.</p>}
        </div>
      </div>
    </div>
  );
}
