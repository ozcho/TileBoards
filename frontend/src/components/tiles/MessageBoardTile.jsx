import { useState, useEffect } from 'react';

export default function MessageBoardTile({ tile, socket, isOwnerOrAdmin, user, guestName }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const visibility = tile.config?.visibility || 'all';
  const canWrite = visibility === 'all' || isOwnerOrAdmin;

  useEffect(() => {
    // Request messages when socket connects/reconnects
    const requestMessages = () => {
      socket.emit('messages-get', { tileId: tile.id });
    };

    // Request immediately and also on reconnect
    if (socket.connected) {
      requestMessages();
    }
    socket.on('connect', requestMessages);

    const handleMessages = ({ tileId, messages: msgs }) => {
      if (tileId === tile.id) setMessages(msgs);
    };
    const handleNewMessage = ({ tileId, message }) => {
      if (tileId === tile.id) {
        setMessages(prev => [message, ...prev]);
      }
    };
    const handleDeleteMessage = ({ tileId, messageId }) => {
      if (tileId === tile.id) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    };

    socket.on('messages-list', handleMessages);
    socket.on('message-added', handleNewMessage);
    socket.on('message-deleted', handleDeleteMessage);

    return () => {
      socket.off('connect', requestMessages);
      socket.off('messages-list', handleMessages);
      socket.off('message-added', handleNewMessage);
      socket.off('message-deleted', handleDeleteMessage);
    };
  }, [tile.id, socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('message-add', {
      tileId: tile.id,
      text: text.trim(),
      authorName: user?.name || guestName || 'Anónimo'
    });
    setText('');
  };

  const handleDelete = (messageId) => {
    socket.emit('message-delete', { tileId: tile.id, messageId });
  };

  return (
    <div className="tile tile-messageboard">
      <h3 className="tile-label">{tile.label || 'Mensajes'}</h3>

      {canWrite ? (
        <form onSubmit={handleSubmit} className="message-form">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="input"
            maxLength={500}
          />
          <button type="submit" className="btn btn-primary btn-sm">Enviar</button>
        </form>
      ) : (
        <p className="message-restricted">Solo el dueño y admins pueden escribir mensajes</p>
      )}

      <div className="messages-list">
        {messages.map(msg => (
          <div key={msg.id} className="message-item">
            <div className="message-header">
              <span className="message-author">{msg.author_name}</span>
              <span className="message-time">
                {new Date(msg.created_at).toLocaleString('es')}
              </span>
              {isOwnerOrAdmin && (
                <button onClick={() => handleDelete(msg.id)} className="btn btn-xs btn-danger">✕</button>
              )}
            </div>
            <p className="message-text">{msg.text}</p>
          </div>
        ))}
        {messages.length === 0 && <p className="tile-empty">No hay mensajes aún</p>}
      </div>
    </div>
  );
}
