import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TokenIcon from '../components/tiles/TokenIcon';

const TILE_TYPES = [
  { value: 'countdown', label: '⏳ Cuenta Atrás' },
  { value: 'stopwatch', label: '⏱ Cronómetro' },
  { value: 'clock', label: '🕐 Reloj' },
  { value: 'counter', label: '🔢 Contador' },
  { value: 'messageboard', label: '💬 Tablón de Mensajes' },
  { value: 'chaosbag', label: '🎒 Bolsa del Caos' },
  { value: 'arkham_bag', label: '🐙 Bolsa PAP' },
];

function ArkhamBagEditor({ tile, onChange }) {
  const config = tile.config || {};
  const [campaigns, setCampaigns] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [difficulties, setDifficulties] = useState([]);

  const campaign = config.campaign || '';
  const scenario = config.scenario || '';
  const difficulty = config.difficulty || '';

  useEffect(() => {
    fetch('/api/presets/campaigns')
      .then(r => r.json())
      .then(setCampaigns)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!campaign) { setScenarios([]); return; }
    fetch(`/api/presets/scenarios?campaign=${encodeURIComponent(campaign)}`)
      .then(r => r.json())
      .then(setScenarios)
      .catch(() => {});
  }, [campaign]);

  useEffect(() => {
    if (!campaign || !scenario) { setDifficulties([]); return; }
    fetch(`/api/presets/difficulties?campaign=${encodeURIComponent(campaign)}&scenario=${encodeURIComponent(scenario)}`)
      .then(r => r.json())
      .then(setDifficulties)
      .catch(() => {});
  }, [campaign, scenario]);

  const applyPreset = (c, s, d) => {
    if (!c || !s || !d) return;
    fetch(`/api/presets/config?campaign=${encodeURIComponent(c)}&scenario=${encodeURIComponent(s)}&difficulty=${encodeURIComponent(d)}`)
      .then(r => r.json())
      .then(({ tokenCounts, campaignLog, victoryRequirements, scenarioValue }) => {
        const bag = [];
        Object.entries(tokenCounts).forEach(([token, count]) => {
          for (let i = 0; i < count; i++) bag.push(token);
        });
        onChange({
          config: { ...config, campaign: c, scenario: s, difficulty: d, tokenCounts, campaignLog, victoryRequirements, scenarioValue },
          state: { bag, drawn: [], locked: [] }
        });
      })
      .catch(() => {});
  };

  const handleCampaign = (c) => {
    onChange({ config: { ...config, campaign: c, scenario: '', difficulty: '', tokenCounts: undefined } });
  };

  const handleScenario = (s) => {
    onChange({ config: { ...config, scenario: s, difficulty: '', tokenCounts: undefined } });
  };

  const handleDifficulty = (d) => {
    onChange({ config: { ...config, difficulty: d } });
    applyPreset(campaign, scenario, d);
  };

  const total = config.tokenCounts ? Object.values(config.tokenCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="form-group">
      <label>Campaña</label>
      <select value={campaign} onChange={e => handleCampaign(e.target.value)} className="input">
        <option value="">— Selecciona campaña —</option>
        {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <label style={{ marginTop: '0.5rem' }}>Escenario</label>
      <select value={scenario} onChange={e => handleScenario(e.target.value)} className="input" disabled={!campaign}>
        <option value="">— Selecciona escenario —</option>
        {scenarios.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <label style={{ marginTop: '0.5rem' }}>Dificultad</label>
      <select value={difficulty} onChange={e => handleDifficulty(e.target.value)} className="input" disabled={!scenario}>
        <option value="">— Selecciona dificultad —</option>
        {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      {config.tokenCounts && (
        <div style={{ marginTop: '0.75rem' }}>
          <label>Contenido de la bolsa ({total} fichas)</label>
          <div className="chaosbag-editor-tokens">
            {['+1', '0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8',
              'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star', 'frost'].map(token => {
              const count = config.tokenCounts[token] || 0;
              if (count === 0) return null;
              return (
                <div key={token} className="chaosbag-editor-token-row">
                  <span className="chaosbag-editor-token-label">
                    <TokenIcon token={token} size={18} />
                  </span>
                  <span className="chaosbag-editor-token-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BoardEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [tiles, setTiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditing) return;

    fetch(`/api/boards/${id}`, { credentials: 'include' })
      .then(res => {
        const contentType = res.headers.get('content-type');
        if (!res.ok || !contentType?.includes('application/json')) {
          throw new Error('No autorizado o error del servidor');
        }
        return res.json();
      })
      .then(data => {
        setName(data.name);
        setTiles(data.tiles.map(t => ({
          ...t,
          config: typeof t.config === 'string' ? JSON.parse(t.config) : t.config,
          state: typeof t.state === 'string' ? JSON.parse(t.state) : t.state,
        })));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id, isEditing]);

  const addTile = (type) => {
    const newTile = {
      id: crypto.randomUUID(),
      type,
      label: TILE_TYPES.find(t => t.value === type)?.label.split(' ').slice(1).join(' ') || type,
      config: type === 'countdown' ? { hours: 0, minutes: 5, seconds: 0 } :
              type === 'stopwatch' ? {} :
              type === 'clock' ? { timezone: 'Europe/Madrid', format: '24h' } :
              type === 'messageboard' ? { visibility: 'all' } :
              type === 'counter' ? { historyVisibility: 'none' } :
              type === 'chaosbag' ? { preset: 'standard', tokenCounts: { '+1': 1, '0': 2, '-1': 3, '-2': 2, '-3': 1, '-4': 1, skull: 2, cultist: 1, tablet: 1, elder_thing: 1, tentacle: 1, elder_star: 1 } } :
              type === 'arkham_bag' ? { campaign: '', scenario: '', difficulty: '' } : {},
      state: type === 'counter' ? { value: 0 } :
             type === 'stopwatch' ? { startedAt: null, paused: false, pausedElapsed: 0 } :
             type === 'chaosbag' ? {
               bag: ['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star'],
               drawn: [],
               locked: []
             } :
             type === 'arkham_bag' ? { bag: [], drawn: [], locked: [] } : {},
    };
    setTiles([...tiles, newTile]);
  };

  const updateTile = (index, updates) => {
    setTiles(tiles.map((t, i) => i === index ? { ...t, ...updates } : t));
  };

  const removeTile = (index) => {
    setTiles(tiles.filter((_, i) => i !== index));
  };

  const moveTile = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tiles.length) return;
    const newTiles = [...tiles];
    [newTiles[index], newTiles[newIndex]] = [newTiles[newIndex], newTiles[index]];
    setTiles(newTiles);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const body = { name, tiles };
    if (password) body.password = password;
    if (!isEditing && !password) {
      setError('La contraseña es requerida para nuevos boards');
      setSaving(false);
      return;
    }

    try {
      const url = isEditing ? `/api/boards/${id}` : '/api/boards';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const ct = res.headers.get('content-type');
        const data = ct?.includes('application/json') ? await res.json() : {};
        throw new Error(data.error || `Error al guardar (${res.status})`);
      }

      const data = await res.json();
      const boardId = isEditing ? id : data.id;
      navigate(`/board/${boardId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="board-editor">
      <h1>{isEditing ? 'Editar Board' : 'Nuevo Board'}</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre del Board</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="input"
            required
            placeholder="Mi Board"
          />
        </div>

        <div className="form-group">
          <label>{isEditing ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña de Acceso'}</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="input"
            placeholder="Contraseña para acceder al board"
            required={!isEditing}
          />
        </div>

        <div className="tiles-editor">
          <h2>Tiles</h2>
          <div className="add-tile-buttons">
            {TILE_TYPES.map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => addTile(type.value)}
                className="btn btn-sm btn-secondary"
              >
                + {type.label}
              </button>
            ))}
          </div>

          <div className="tiles-list">
            {tiles.map((tile, index) => (
              <div key={tile.id} className="tile-editor-card">
                <div className="tile-editor-header">
                  <span className="tile-type-badge">
                    {TILE_TYPES.find(t => t.value === tile.type)?.label}
                  </span>
                  <div className="tile-editor-actions">
                    <button type="button" onClick={() => moveTile(index, -1)} className="btn btn-xs" disabled={index === 0}>↑</button>
                    <button type="button" onClick={() => moveTile(index, 1)} className="btn btn-xs" disabled={index === tiles.length - 1}>↓</button>
                    <button type="button" onClick={() => removeTile(index)} className="btn btn-xs btn-danger">✕</button>
                  </div>
                </div>

                <div className="tile-editor-body">
                  <div className="form-group">
                    <label>Etiqueta</label>
                    <input
                      type="text"
                      value={tile.label}
                      onChange={e => updateTile(index, { label: e.target.value })}
                      className="input"
                      placeholder="Etiqueta del tile"
                    />
                  </div>

                  {tile.type === 'countdown' && (
                    <div className="form-group">
                      <label>Duración</label>
                      <div className="countdown-inputs">
                        <div className="countdown-input-group">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={tile.config.hours || 0}
                            onChange={e => updateTile(index, { config: { ...tile.config, hours: parseInt(e.target.value) || 0 } })}
                            className="input"
                          />
                          <span>h</span>
                        </div>
                        <div className="countdown-input-group">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={tile.config.minutes || 0}
                            onChange={e => updateTile(index, { config: { ...tile.config, minutes: parseInt(e.target.value) || 0 } })}
                            className="input"
                          />
                          <span>m</span>
                        </div>
                        <div className="countdown-input-group">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={tile.config.seconds || 0}
                            onChange={e => updateTile(index, { config: { ...tile.config, seconds: parseInt(e.target.value) || 0 } })}
                            className="input"
                          />
                          <span>s</span>
                        </div>
                      </div>
                      <label className="checkbox-label" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={tile.config.lockOnZero || false}
                          onChange={e => updateTile(index, { config: { ...tile.config, lockOnZero: e.target.checked } })}
                        />
                        Bloquear todos los tiles al llegar a 0
                      </label>
                    </div>
                  )}

                  {tile.type === 'clock' && (
                    <>
                      <div className="form-group">
                        <label>Zona horaria</label>
                        <select
                          value={tile.config.timezone || 'Europe/Madrid'}
                          onChange={e => updateTile(index, { config: { ...tile.config, timezone: e.target.value } })}
                          className="input"
                        >
                          <option value="Europe/Madrid">Madrid</option>
                          <option value="Europe/London">Londres</option>
                          <option value="America/New_York">Nueva York</option>
                          <option value="America/Los_Angeles">Los Ángeles</option>
                          <option value="America/Mexico_City">Ciudad de México</option>
                          <option value="America/Bogota">Bogotá</option>
                          <option value="America/Buenos_Aires">Buenos Aires</option>
                          <option value="Asia/Tokyo">Tokio</option>
                          <option value="Australia/Sydney">Sídney</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Formato</label>
                        <select
                          value={tile.config.format || '24h'}
                          onChange={e => updateTile(index, { config: { ...tile.config, format: e.target.value } })}
                          className="input"
                        >
                          <option value="24h">24 horas</option>
                          <option value="12h">12 horas</option>
                        </select>
                      </div>
                    </>
                  )}

                  {tile.type === 'counter' && (
                    <>
                      <div className="form-group">
                        <label>Valor inicial</label>
                        <input
                          type="number"
                          value={tile.state.value || 0}
                          onChange={e => updateTile(index, { state: { ...tile.state, value: parseInt(e.target.value) || 0 } })}
                          className="input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Historial de cambios</label>
                        <select
                          value={tile.config.historyVisibility || 'none'}
                          onChange={e => updateTile(index, { config: { ...tile.config, historyVisibility: e.target.value } })}
                          className="input"
                        >
                          <option value="none">Deshabilitado</option>
                          <option value="owner_admin">Solo dueño y admins</option>
                          <option value="all">Visible para todos</option>
                        </select>
                      </div>
                    </>
                  )}

                  {tile.type === 'messageboard' && (
                    <div className="form-group">
                      <label>Visibilidad de la caja de texto</label>
                      <select
                        value={tile.config.visibility || 'all'}
                        onChange={e => updateTile(index, { config: { ...tile.config, visibility: e.target.value } })}
                        className="input"
                      >
                        <option value="all">Visible para todos</option>
                        <option value="owner_admin">Solo dueño y admin</option>
                      </select>
                    </div>
                  )}

                  {tile.type === 'chaosbag' && (
                    <div className="form-group">
                      <label>Preset de dificultad</label>
                      <select
                        value={tile.config.preset || 'standard'}
                        onChange={e => {
                          const presets = {
                            easy: ['+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-3', 'skull', 'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star'],
                            standard: ['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star'],
                            hard: ['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', 'skull', 'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star'],
                            expert: ['0', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8', 'skull', 'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star'],
                          };
                          const preset = e.target.value;
                          const bag = presets[preset] || presets.standard;
                          const counts = {};
                          bag.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
                          updateTile(index, {
                            config: { ...tile.config, preset, tokenCounts: counts },
                            state: { bag: [...bag], drawn: [], locked: [] }
                          });
                        }}
                        className="input"
                      >
                        <option value="easy">Fácil</option>
                        <option value="standard">Estándar</option>
                        <option value="hard">Difícil</option>
                        <option value="expert">Experto</option>
                      </select>

                      <label style={{ marginTop: '0.75rem' }}>Fichas en la bolsa</label>
                      <div className="chaosbag-editor-tokens">
                        {['+1', '0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8',
                          'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star', 'frost'].map(token => {
                          const counts = tile.config.tokenCounts || {};
                          const count = counts[token] || 0;
                          return (
                            <div key={token} className="chaosbag-editor-token-row">
                              <span className="chaosbag-editor-token-label">
                                <TokenIcon token={token} size={18} />
                              </span>
                              <button
                                type="button"
                                className="btn btn-xs"
                                disabled={count <= 0}
                                onClick={() => {
                                  const newCounts = { ...counts, [token]: Math.max(0, count - 1) };
                                  const bag = [];
                                  Object.entries(newCounts).forEach(([t, c]) => { for (let i = 0; i < c; i++) bag.push(t); });
                                  updateTile(index, {
                                    config: { ...tile.config, preset: 'custom', tokenCounts: newCounts },
                                    state: { bag, drawn: [], locked: [] }
                                  });
                                }}
                              >−</button>
                              <span className="chaosbag-editor-token-count">{count}</span>
                              <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => {
                                  const newCounts = { ...counts, [token]: count + 1 };
                                  const bag = [];
                                  Object.entries(newCounts).forEach(([t, c]) => { for (let i = 0; i < c; i++) bag.push(t); });
                                  updateTile(index, {
                                    config: { ...tile.config, preset: 'custom', tokenCounts: newCounts },
                                    state: { bag, drawn: [], locked: [] }
                                  });
                                }}
                              >+</button>
                            </div>
                          );
                        })}
                      </div>
                      <p className="form-hint">Total: {Object.values(tile.config.tokenCounts || {}).reduce((a, b) => a + b, 0)} fichas. Se puede modificar durante la partida.</p>
                    </div>
                  )}
                  {tile.type === 'arkham_bag' && (
                    <ArkhamBagEditor
                      tile={tile}
                      onChange={(updates) => updateTile(index, updates)}
                    />
                  )}

                  {tile.type === 'stopwatch' && (
                    <div className="form-group" style={{ marginTop: '0.75rem' }}>
                      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={tile.config.showControlsToAll || false}
                          onChange={e => updateTile(index, { config: { ...tile.config, showControlsToAll: e.target.checked } })}
                        />
                        Mostrar controles a todos los usuarios
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Board')}
          </button>
          <button type="button" onClick={() => navigate('/')} className="btn">Cancelar</button>
        </div>
      </form>
    </div>
  );
}
