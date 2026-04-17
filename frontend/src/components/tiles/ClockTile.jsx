import { useState, useEffect } from 'react';

export default function ClockTile({ tile }) {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const timezone = tile.config?.timezone || 'Europe/Madrid';
      const format = tile.config?.format || '24h';

      const now = new Date();
      const timeOptions = {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: format === '12h'
      };
      const dateOptions = {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };

      setTime(now.toLocaleTimeString('es-ES', timeOptions));
      setDate(now.toLocaleDateString('es-ES', dateOptions));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [tile.config?.timezone, tile.config?.format]);

  return (
    <div className="tile tile-clock">
      <h3 className="tile-label">{tile.label || 'Reloj'}</h3>
      <div className="clock-display">{time}</div>
      <div className="clock-date">{date}</div>
      <div className="clock-timezone">{tile.config?.timezone || 'Europe/Madrid'}</div>
    </div>
  );
}
