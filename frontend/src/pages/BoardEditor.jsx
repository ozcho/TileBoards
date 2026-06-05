import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TokenIcon from '../components/tiles/TokenIcon';
import iconBrownWorm from '../tokens/jungle-icons-clean/icon-brown-worm.png';
import iconGreenDiamond from '../tokens/jungle-icons-clean/icon-green-diamond.png';
import iconMagentaCrescent from '../tokens/jungle-icons-clean/icon-magenta-crescent.png';
import iconMaroonHourglass from '../tokens/jungle-icons-clean/icon-maroon-hourglass.png';
import iconNavyHat from '../tokens/jungle-icons-clean/icon-navy-hat.png';
import iconOliveSlash from '../tokens/jungle-icons-clean/icon-olive-slash.png';
import iconOrangeHeart from '../tokens/jungle-icons-clean/icon-orange-heart.png';
import iconPurpleTriangle from '../tokens/jungle-icons-clean/icon-purple-triangle.png';
import iconRedSquare from '../tokens/jungle-icons-clean/icon-red-square.png';
import iconYellowRing from '../tokens/jungle-icons-clean/icon-yellow-ring.png';

const ALL_DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

const SPECIAL_DICE_TEXT_LIMIT = 6;
const SPECIAL_DICE_DEFAULT_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const RANDOM_CARD_TEXT_LIMIT = 16;

const ARKHAM_LOCATION_CARDS = [
  'brown-worm',
  'green-diamond',
  'magenta-crescent',
  'maroon-hourglass',
  'navy-hat',
  'olive-slash',
  'orange-heart',
  'purple-triangle',
  'red-square',
  'yellow-ring'
];

const ARKHAM_EDITOR_ICON_BY_KEY = {
  'brown-worm': iconBrownWorm,
  'green-diamond': iconGreenDiamond,
  'magenta-crescent': iconMagentaCrescent,
  'maroon-hourglass': iconMaroonHourglass,
  'navy-hat': iconNavyHat,
  'olive-slash': iconOliveSlash,
  'orange-heart': iconOrangeHeart,
  'purple-triangle': iconPurpleTriangle,
  'red-square': iconRedSquare,
  'yellow-ring': iconYellowRing
};

function renderRandomCardEditorLabel(text) {
  const cleanText = String(text || '').trim();
  const src = ARKHAM_EDITOR_ICON_BY_KEY[cleanText.toLowerCase()];
  if (src) {
    return <img className="random-card-editor-icon" src={src} alt={cleanText} />;
  }
  return <strong>{cleanText}</strong>;
}

function normalizeDieColor(value, fallback = SPECIAL_DICE_DEFAULT_COLORS[0]) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function createDefaultSpecialDiceConfig() {
  return {
    id: crypto.randomUUID(),
    name: 'Configuracion base',
    dice: [
      {
        id: crypto.randomUUID(),
        title: 'Dado principal',
        color: SPECIAL_DICE_DEFAULT_COLORS[0],
        sides: 6,
        faces: Array(6).fill('')
      }
    ]
  };
}

function clampRandomCardText(value) {
  return Array.from(String(value || '').trim()).slice(0, RANDOM_CARD_TEXT_LIMIT).join('');
}

function createDefaultRandomCardConfig() {
  return {
    id: crypto.randomUUID(),
    name: 'Lugares de Arkham',
    cards: ARKHAM_LOCATION_CARDS.map((text) => ({ id: crypto.randomUUID(), text }))
  };
}

const TILE_TYPES = [
  { value: 'countdown', label: '⏳ Cuenta Atrás' },
  { value: 'stopwatch', label: '⏱ Cronómetro' },
  { value: 'clock', label: '🕐 Reloj' },
  { value: 'counter', label: '🔢 Contador' },
  { value: 'messageboard', label: '💬 Tablón de Mensajes' },
  { value: 'chaosbag', label: '🎒 Bolsa del Caos' },
  { value: 'arkham_bag', label: '🐙 Bolsa PAP' },
  { value: 'dice', label: '🎲 Dados' },
  { value: 'special_dice', label: '🎲 Dados Especiales' },
  { value: 'random_cards', label: '🃏 Cartas Aleatorias' },
];

function SpecialDiceConfigEditor({ tile, onChange }) {
  const config = tile.config || {};
  const selectedConfigId = config.selectedConfigId || '';

  // Source of truth: loaded from API. Kept in sync with tile.config.configurations
  // so the board tile view always has the full data embedded.
  const [apiConfigs, setApiConfigs] = useState(
    Array.isArray(config.configurations) ? config.configurations : []
  );
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [apiError, setApiError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState(null); // null = create, id = edit
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [draftDice, setDraftDice] = useState([]);
  const [dieTitle, setDieTitle] = useState('');
  const [dieSides, setDieSides] = useState(6);
  const [dieColor, setDieColor] = useState(SPECIAL_DICE_DEFAULT_COLORS[0]);

  // Load configs from API on mount
  useEffect(() => {
    setLoadingConfigs(true);
    fetch('/api/special-dice-configs', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        setApiConfigs(data);
        // Sync tile.config so the board view has the latest data
        const newSelectedId = data.find(c => c.id === config.selectedConfigId)
          ? config.selectedConfigId
          : data[0]?.id || '';
        onChange({ config: { ...config, configurations: data, selectedConfigId: newSelectedId } });
      })
      .catch(() => setApiError('No se pudieron cargar las configuraciones.'))
      .finally(() => setLoadingConfigs(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedConfig = apiConfigs.find(c => c.id === selectedConfigId);

  const openModal = () => {
    setEditingConfigId(null);
    setNewName('');
    setDraftDice([]);
    setDieTitle('');
    setDieSides(6);
    setDieColor(SPECIAL_DICE_DEFAULT_COLORS[0]);
    setModalError('');
    setShowModal(true);
  };

  const openEditModal = () => {
    if (!selectedConfig) return;
    setEditingConfigId(selectedConfig.id);
    setNewName(selectedConfig.name);
    setDraftDice(
      (Array.isArray(selectedConfig.dice) ? selectedConfig.dice : []).map(d => ({
        id: d.id || crypto.randomUUID(),
        title: d.title || 'Dado',
        color: normalizeDieColor(d.color, SPECIAL_DICE_DEFAULT_COLORS[0]),
        sides: Math.max(2, Math.min(100, parseInt(d.sides, 10) || 6)),
        faces: Array.isArray(d.faces) ? [...d.faces] : []
      }))
    );
    setDieTitle('');
    setDieSides(6);
    setDieColor(SPECIAL_DICE_DEFAULT_COLORS[0]);
    setModalError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingConfigId(null);
    setModalError('');
  };

  const addDraftDie = () => {
    const cleanTitle = dieTitle.trim();
    const normalizedSides = Math.max(2, Math.min(100, parseInt(dieSides, 10) || 2));

    if (!cleanTitle) {
      setModalError('El titulo del dado es obligatorio.');
      return;
    }

    setDraftDice(prev => ([
      ...prev,
      {
        id: crypto.randomUUID(),
        title: cleanTitle,
        color: normalizeDieColor(dieColor, SPECIAL_DICE_DEFAULT_COLORS[draftDice.length % SPECIAL_DICE_DEFAULT_COLORS.length]),
        sides: normalizedSides,
        faces: Array(normalizedSides).fill('')
      }
    ]));
    setDieTitle('');
    setDieSides(6);
    setDieColor(SPECIAL_DICE_DEFAULT_COLORS[(draftDice.length + 1) % SPECIAL_DICE_DEFAULT_COLORS.length]);
    setModalError('');
  };

  const removeDraftDie = (dieId) => {
    setDraftDice(prev => prev.filter(d => d.id !== dieId));
  };

  const updateFaceText = (dieId, faceIndex, value) => {
    const chars = Array.from(value || '');
    const trimmed = chars.slice(0, SPECIAL_DICE_TEXT_LIMIT).join('');
    setDraftDice(prev => prev.map(d => {
      if (d.id !== dieId) return d;
      const nextFaces = [...d.faces];
      nextFaces[faceIndex] = trimmed;
      return { ...d, faces: nextFaces };
    }));
  };

  const addFaceSlot = (dieId) => {
    setDraftDice(prev => prev.map(d => {
      if (d.id !== dieId) return d;
      if (d.faces.length >= d.sides) return d;
      return { ...d, faces: [...d.faces, ''] };
    }));
  };

  const deleteSelectedConfig = async () => {
    if (apiConfigs.length <= 1) return;
    try {
      const res = await fetch(`/api/special-dice-configs/${selectedConfigId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setApiError(data.error || 'Error al eliminar la configuracion.');
        return;
      }
      const remaining = apiConfigs.filter(c => c.id !== selectedConfigId);
      setApiConfigs(remaining);
      onChange({
        config: { ...config, configurations: remaining, selectedConfigId: remaining[0]?.id || '' },
        state: { lastRoll: null, history: [] }
      });
    } catch {
      setApiError('Error de red al eliminar la configuracion.');
    }
  };

  const saveNewConfig = async () => {
    const cleanName = newName.trim();
    if (!cleanName) {
      setModalError('El nombre de la configuracion es obligatorio.');
      return;
    }
    if (draftDice.length === 0) {
      setModalError('Debes agregar al menos un dado.');
      return;
    }

    const sanitizedDice = draftDice.map(d => ({
      ...d,
      color: normalizeDieColor(d.color, SPECIAL_DICE_DEFAULT_COLORS[0]),
      faces: (d.faces || []).slice(0, d.sides).map(face => Array.from(face || '').slice(0, SPECIAL_DICE_TEXT_LIMIT).join(''))
    }));

    setSaving(true);
    try {
      const isEditing = !!editingConfigId;
      const url = isEditing
        ? `/api/special-dice-configs/${editingConfigId}`
        : '/api/special-dice-configs';
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: cleanName, dice: sanitizedDice })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setModalError(data.error || 'Error al guardar la configuracion.');
        return;
      }
      const saved = await res.json();
      const nextConfigs = isEditing
        ? apiConfigs.map(c => c.id === saved.id ? saved : c)
        : [...apiConfigs, saved];
      setApiConfigs(nextConfigs);
      onChange({
        config: { ...config, configurations: nextConfigs, selectedConfigId: saved.id },
        state: { lastRoll: null, history: [] }
      });
      closeModal();
    } catch {
      setModalError('Error de red al guardar la configuracion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-group">
      {apiError && <div className="alert alert-error" style={{ marginBottom: '0.5rem' }}>{apiError}</div>}
      <label>Configuracion activa {loadingConfigs && <span style={{ fontWeight: 400, opacity: 0.6 }}>(cargando…)</span>}</label>
      <select
        value={selectedConfigId}
        onChange={e => onChange({ config: { ...config, selectedConfigId: e.target.value } })}
        className="input"
        disabled={loadingConfigs}
      >
        {apiConfigs.map(cfg => (
          <option key={cfg.id} value={cfg.id}>{cfg.name}</option>
        ))}
      </select>

      <div className="special-dice-editor-actions">
        <button type="button" className="btn btn-sm btn-secondary" onClick={openModal} disabled={loadingConfigs}>
          + Nueva configuracion
        </button>
        {selectedConfig && (
          <button type="button" className="btn btn-sm" onClick={openEditModal} disabled={loadingConfigs}>
            ✏️ Editar
          </button>
        )}
        {apiConfigs.length > 1 && (
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={deleteSelectedConfig}
            title="Eliminar esta configuracion"
          >
            🗑 Eliminar
          </button>
        )}
      </div>

      {selectedConfig ? (
        <div className="special-dice-config-preview">
          {selectedConfig.dice.map((die) => (
            <div key={die.id} className="special-dice-config-preview-item">
              <strong>{die.title}</strong>
              <span>{die.sides} caras</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="form-hint">{loadingConfigs ? 'Cargando…' : 'No hay configuraciones disponibles.'}</p>
      )}

      {showModal && (
        <div className="special-dice-modal-overlay" onClick={closeModal}>
          <div className="special-dice-modal" onClick={e => e.stopPropagation()}>
            <h3>{editingConfigId ? 'Editar configuracion de dados' : 'Nueva configuracion de dados'}</h3>
            {modalError && <div className="alert alert-error">{modalError}</div>}

            <div className="form-group">
              <label>Nombre de la configuracion</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="input"
                placeholder="Ej: Daño + Estado"
              />
            </div>

            <div className="special-dice-modal-adddie">
              <h4>Agregar dado</h4>
              <div className="form-group">
                <label>Titulo del dado</label>
                <input
                  type="text"
                  value={dieTitle}
                  onChange={e => setDieTitle(e.target.value)}
                  className="input"
                  placeholder="Ej: Dado de daño"
                />
              </div>
              <div className="form-group">
                <label>Numero de caras</label>
                <input
                  type="number"
                  min="2"
                  max="100"
                  value={dieSides}
                  onChange={e => setDieSides(e.target.value)}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Color del dado</label>
                <input
                  type="color"
                  value={dieColor}
                  onChange={e => setDieColor(normalizeDieColor(e.target.value))}
                  className="special-dice-color-input"
                />
              </div>
              <button type="button" className="btn btn-sm" onClick={addDraftDie}>Agregar dado</button>
            </div>

            <div className="special-dice-modal-dice-list">
              {draftDice.map(die => (
                <div key={die.id} className="special-dice-modal-die-card">
                  <div className="special-dice-modal-die-header">
                    <strong className="special-dice-die-title-with-color">
                      <span className="special-dice-color-dot" style={{ backgroundColor: normalizeDieColor(die.color, SPECIAL_DICE_DEFAULT_COLORS[0]) }} />
                      {die.title}
                    </strong>
                    <span>{die.sides} caras</span>
                    <button type="button" className="btn btn-xs btn-danger" onClick={() => removeDraftDie(die.id)}>Eliminar</button>
                  </div>

                  <div className="special-dice-modal-faces-grid">
                    {die.faces.map((face, faceIndex) => (
                      <label key={`${die.id}-${faceIndex}`} className="special-dice-face-input">
                        <span>Cara {faceIndex + 1}</span>
                        <input
                          type="text"
                          value={face}
                          maxLength={SPECIAL_DICE_TEXT_LIMIT * 2}
                          onChange={e => updateFaceText(die.id, faceIndex, e.target.value)}
                          className="input"
                          placeholder="Texto o emoji"
                        />
                      </label>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn btn-xs"
                    onClick={() => addFaceSlot(die.id)}
                    disabled={die.faces.length >= die.sides}
                  >
                    + Agregar cara
                  </button>
                </div>
              ))}
            </div>

            <p className="form-hint">Cada cara admite hasta {SPECIAL_DICE_TEXT_LIMIT} caracteres (incluye emojis).</p>

            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={saveNewConfig} disabled={saving}>
                {saving ? 'Guardando…' : (editingConfigId ? 'Guardar cambios' : 'Guardar configuracion')}
              </button>
              <button type="button" className="btn" onClick={closeModal} disabled={saving}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RandomCardsConfigEditor({ tile, onChange }) {
  const config = tile.config || {};
  const selectedConfigId = config.selectedConfigId || '';

  const [apiConfigs, setApiConfigs] = useState(
    Array.isArray(config.configurations) ? config.configurations : []
  );
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [apiError, setApiError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState(null);
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [draftCards, setDraftCards] = useState([]);

  const selectedCardCountsByConfigId =
    config.selectedCardCountsByConfigId && typeof config.selectedCardCountsByConfigId === 'object'
      ? config.selectedCardCountsByConfigId
      : {};
  const legacySelectedCardIdsByConfigId =
    config.selectedCardIdsByConfigId && typeof config.selectedCardIdsByConfigId === 'object'
      ? config.selectedCardIdsByConfigId
      : {};

  const getCardCountForConfigCard = (cfg, cardId, countsMap = selectedCardCountsByConfigId) => {
    const configId = String(cfg?.id || '').trim();
    const normalizedCardId = String(cardId || '').trim();
    if (!configId || !normalizedCardId) return 0;

    const hasCounts = Object.prototype.hasOwnProperty.call(countsMap, configId)
      && countsMap[configId]
      && typeof countsMap[configId] === 'object';
    if (hasCounts) {
      if (!Object.prototype.hasOwnProperty.call(countsMap[configId], normalizedCardId)) {
        return 1;
      }
      const raw = parseInt(countsMap[configId][normalizedCardId], 10);
      return Number.isFinite(raw) ? Math.max(0, raw) : 1;
    }

    const hasLegacySubset = Object.prototype.hasOwnProperty.call(legacySelectedCardIdsByConfigId, configId);
    if (hasLegacySubset) {
      const legacyIds = Array.isArray(legacySelectedCardIdsByConfigId[configId])
        ? legacySelectedCardIdsByConfigId[configId].map((id) => String(id || '').trim())
        : [];
      return legacyIds.includes(normalizedCardId) ? 1 : 0;
    }

    return 1;
  };

  const getCardsForTile = (cfg, countsMap = selectedCardCountsByConfigId) => {
    const baseCards = Array.isArray(cfg?.cards) ? cfg.cards : [];
    const expandedCards = [];

    baseCards.forEach((card) => {
      const cardId = String(card?.id || '').trim();
      if (!cardId) return;
      const count = getCardCountForConfigCard(cfg, cardId, countsMap);
      for (let i = 0; i < count; i += 1) {
        expandedCards.push(card);
      }
    });

    return expandedCards;
  };

  const cardsToState = (cards) => {
    const cardIds = (Array.isArray(cards) ? cards : [])
      .map(c => String(c?.id || '').trim())
      .filter(Boolean);
    return { remaining: cardIds, drawn: [], lastDraw: null, history: [] };
  };

  useEffect(() => {
    const loadConfigs = async () => {
      setLoadingConfigs(true);
      try {
        const initialRes = await fetch('/api/random-card-configs', { credentials: 'include' });
        if (!initialRes.ok) throw new Error('load_failed');
        let data = await initialRes.json();

        const hasArkhamPreset = data.some((cfg) => String(cfg?.name || '').trim() === 'Lugares de Arkham');
        if (!hasArkhamPreset) {
          const presetCards = ARKHAM_LOCATION_CARDS.map((text) => ({
            id: crypto.randomUUID(),
            text
          }));

          const createRes = await fetch('/api/random-card-configs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: 'Lugares de Arkham', cards: presetCards })
          });

          if (createRes.ok) {
            const created = await createRes.json();
            data = [...data, created];
          }
        }

        setApiConfigs(data);
        const newSelectedId = data.find(c => c.id === config.selectedConfigId)
          ? config.selectedConfigId
          : data[0]?.id || '';
        const selected = data.find(c => c.id === newSelectedId);
        onChange({
          config: {
            ...config,
            configurations: data,
            selectedConfigId: newSelectedId,
            selectedCardCountsByConfigId
          },
          ...(selected ? { state: cardsToState(getCardsForTile(selected, selectedCardCountsByConfigId)) } : {})
        });
      } catch {
        setApiError('No se pudieron cargar las configuraciones.');
      } finally {
        setLoadingConfigs(false);
      }
    };

    loadConfigs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedConfig = apiConfigs.find(c => c.id === selectedConfigId);
  const selectedCardsForTile = getCardsForTile(selectedConfig);

  const openModal = () => {
    setEditingConfigId(null);
    setNewName('');
    setDraftCards([]);
    setModalError('');
    setShowModal(true);
  };

  const openEditModal = () => {
    if (!selectedConfig) return;
    setEditingConfigId(selectedConfig.id);
    setNewName(selectedConfig.name);
    setDraftCards(
      (Array.isArray(selectedConfig.cards) ? selectedConfig.cards : []).map(card => ({
        id: card.id || crypto.randomUUID(),
        text: clampRandomCardText(card.text || '')
      }))
    );
    setModalError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingConfigId(null);
    setModalError('');
  };

  const setCardCountFromActiveConfig = (cardId, rawValue) => {
    if (!selectedConfig) return;

    const cfgId = String(selectedConfig.id || '').trim();
    if (!cfgId) return;
    const normalizedCardId = String(cardId || '').trim();
    if (!normalizedCardId) return;

    const parsedValue = parseInt(rawValue, 10);
    const safeCount = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;

    // Build from effective counts (including defaults and legacy selection)
    // so updating one card does not accidentally reset others.
    const baseCounts = {};
    (Array.isArray(selectedConfig.cards) ? selectedConfig.cards : []).forEach((card) => {
      const id = String(card?.id || '').trim();
      if (!id) return;
      baseCounts[id] = getCardCountForConfigCard(selectedConfig, id, selectedCardCountsByConfigId);
    });

    const nextCountsForConfig = { ...baseCounts, [normalizedCardId]: safeCount };
    const nextSubsets = { ...selectedCardCountsByConfigId, [cfgId]: nextCountsForConfig };
    onChange({
      config: { ...config, selectedCardCountsByConfigId: nextSubsets },
      state: cardsToState(getCardsForTile(selectedConfig, nextSubsets))
    });
  };

  const selectAllCardsFromActiveConfig = () => {
    if (!selectedConfig) return;
    const cfgId = String(selectedConfig.id || '').trim();
    if (!cfgId) return;

    const allCounts = {};
    (Array.isArray(selectedConfig.cards) ? selectedConfig.cards : []).forEach((card) => {
      const id = String(card?.id || '').trim();
      if (id) allCounts[id] = 1;
    });
    const nextSubsets = { ...selectedCardCountsByConfigId, [cfgId]: allCounts };

    onChange({
      config: { ...config, selectedCardCountsByConfigId: nextSubsets },
      state: cardsToState(getCardsForTile(selectedConfig, nextSubsets))
    });
  };

  const clearCardsFromActiveConfig = () => {
    if (!selectedConfig) return;
    const cfgId = String(selectedConfig.id || '').trim();
    if (!cfgId) return;

    const noneCounts = {};
    (Array.isArray(selectedConfig.cards) ? selectedConfig.cards : []).forEach((card) => {
      const id = String(card?.id || '').trim();
      if (id) noneCounts[id] = 0;
    });
    const nextSubsets = { ...selectedCardCountsByConfigId, [cfgId]: noneCounts };
    onChange({
      config: { ...config, selectedCardCountsByConfigId: nextSubsets },
      state: cardsToState(getCardsForTile(selectedConfig, nextSubsets))
    });
  };

  const addDraftCard = () => {
    setDraftCards(prev => [...prev, { id: crypto.randomUUID(), text: '' }]);
  };

  const updateDraftCard = (cardId, value) => {
    const trimmed = clampRandomCardText(value);
    setDraftCards(prev => prev.map(card => (
      card.id === cardId ? { ...card, text: trimmed } : card
    )));
  };

  const removeDraftCard = (cardId) => {
    setDraftCards(prev => prev.filter(card => card.id !== cardId));
  };

  const deleteSelectedConfig = async () => {
    if (apiConfigs.length <= 1) return;
    try {
      const res = await fetch(`/api/random-card-configs/${selectedConfigId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setApiError(data.error || 'Error al eliminar la configuracion.');
        return;
      }
      const remaining = apiConfigs.filter(c => c.id !== selectedConfigId);
      const fallback = remaining[0] || null;
      const nextSubsets = { ...selectedCardCountsByConfigId };
      delete nextSubsets[selectedConfigId];
      setApiConfigs(remaining);
      onChange({
        config: {
          ...config,
          configurations: remaining,
          selectedConfigId: fallback?.id || '',
          selectedCardCountsByConfigId: nextSubsets
        },
        state: cardsToState(getCardsForTile(fallback, nextSubsets))
      });
    } catch {
      setApiError('Error de red al eliminar la configuracion.');
    }
  };

  const saveConfig = async () => {
    const cleanName = newName.trim();
    const sanitizedCards = draftCards
      .map(card => ({ id: card.id || crypto.randomUUID(), text: clampRandomCardText(card.text || '') }))
      .filter(card => card.text !== '');

    if (!cleanName) {
      setModalError('El nombre de la configuracion es obligatorio.');
      return;
    }
    if (sanitizedCards.length === 0) {
      setModalError('Debes agregar al menos una carta con texto.');
      return;
    }

    setSaving(true);
    try {
      const isEditing = !!editingConfigId;
      const url = isEditing
        ? `/api/random-card-configs/${editingConfigId}`
        : '/api/random-card-configs';

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: cleanName, cards: sanitizedCards })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setModalError(data.error || 'Error al guardar la configuracion.');
        return;
      }

      const saved = await res.json();
      const nextConfigs = isEditing
        ? apiConfigs.map(c => c.id === saved.id ? saved : c)
        : [...apiConfigs, saved];

      const nextSubsets = { ...selectedCardCountsByConfigId };
      if (Object.prototype.hasOwnProperty.call(nextSubsets, saved.id)) {
        const validIds = new Set(
          (Array.isArray(saved.cards) ? saved.cards : [])
            .map((card) => String(card?.id || '').trim())
            .filter(Boolean)
        );
        const currentCounts = nextSubsets[saved.id] && typeof nextSubsets[saved.id] === 'object'
          ? nextSubsets[saved.id]
          : {};
        const sanitizedCounts = {};
        Object.entries(currentCounts).forEach(([cardId, rawCount]) => {
          const cleanId = String(cardId || '').trim();
          if (!validIds.has(cleanId)) return;
          const parsedCount = parseInt(rawCount, 10);
          sanitizedCounts[cleanId] = Number.isFinite(parsedCount) ? Math.max(0, parsedCount) : 0;
        });
        nextSubsets[saved.id] = sanitizedCounts;
      }

      setApiConfigs(nextConfigs);
      onChange({
        config: {
          ...config,
          configurations: nextConfigs,
          selectedConfigId: saved.id,
          selectedCardCountsByConfigId: nextSubsets
        },
        state: cardsToState(getCardsForTile(saved, nextSubsets))
      });
      closeModal();
    } catch {
      setModalError('Error de red al guardar la configuracion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-group">
      {apiError && <div className="alert alert-error" style={{ marginBottom: '0.5rem' }}>{apiError}</div>}
      <label>Configuracion activa {loadingConfigs && <span style={{ fontWeight: 400, opacity: 0.6 }}>(cargando…)</span>}</label>
      <select
        value={selectedConfigId}
        onChange={e => {
          const nextId = e.target.value;
          const selected = apiConfigs.find(c => c.id === nextId);
          onChange({
            config: { ...config, selectedConfigId: nextId, selectedCardCountsByConfigId },
            ...(selected ? { state: cardsToState(getCardsForTile(selected, selectedCardCountsByConfigId)) } : {})
          });
        }}
        className="input"
        disabled={loadingConfigs}
      >
        {apiConfigs.map(cfg => (
          <option key={cfg.id} value={cfg.id}>{cfg.name}</option>
        ))}
      </select>

      <div className="special-dice-editor-actions">
        <button type="button" className="btn btn-sm btn-secondary" onClick={openModal} disabled={loadingConfigs}>
          + Nueva configuracion
        </button>
        {selectedConfig && (
          <button type="button" className="btn btn-sm" onClick={openEditModal} disabled={loadingConfigs}>
            ✏️ Editar
          </button>
        )}
        {apiConfigs.length > 1 && (
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={deleteSelectedConfig}
            title="Eliminar esta configuracion"
          >
            🗑 Eliminar
          </button>
        )}
      </div>

      {selectedConfig ? (
        <>
          <p className="form-hint" style={{ marginTop: '0.5rem' }}>
            Cantidad por carta para este tablero: usa 0 para excluir y cualquier n mayor para duplicar.
          </p>
          <div className="special-dice-editor-actions" style={{ marginBottom: '0.5rem' }}>
            <button type="button" className="btn btn-sm" onClick={selectAllCardsFromActiveConfig}>
              Seleccionar todo
            </button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={clearCardsFromActiveConfig}>
              Limpiar
            </button>
          </div>
          <div className="special-dice-config-preview">
            {(Array.isArray(selectedConfig.cards) ? selectedConfig.cards : []).map((card) => {
              const normalizedId = String(card?.id || '').trim();
              const count = getCardCountForConfigCard(selectedConfig, normalizedId);
              return (
                <label key={card.id} className="special-dice-config-preview-item" style={{ cursor: 'pointer' }}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={count}
                    onChange={(e) => setCardCountFromActiveConfig(normalizedId, e.target.value)}
                    className="input random-card-count-input"
                  />
                  {renderRandomCardEditorLabel(card.text)}
                </label>
              );
            })}
          </div>
        </>
      ) : (
        <p className="form-hint">{loadingConfigs ? 'Cargando…' : 'No hay configuraciones disponibles.'}</p>
      )}

      {showModal && (
        <div className="special-dice-modal-overlay" onClick={closeModal}>
          <div className="special-dice-modal" onClick={e => e.stopPropagation()}>
            <h3>{editingConfigId ? 'Editar configuracion de cartas' : 'Nueva configuracion de cartas'}</h3>
            {modalError && <div className="alert alert-error">{modalError}</div>}

            <div className="form-group">
              <label>Nombre de la configuracion</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="input"
                placeholder="Ej: Encuentros acto 1"
              />
            </div>

            <div className="special-dice-modal-dice-list">
              {draftCards.map((card, index) => (
                <div key={card.id} className="special-dice-modal-die-card">
                  <div className="special-dice-modal-die-header" style={{ marginBottom: 0 }}>
                    <strong>Carta {index + 1}</strong>
                    <button type="button" className="btn btn-xs btn-danger" onClick={() => removeDraftCard(card.id)}>Eliminar</button>
                  </div>
                  <input
                    type="text"
                    value={card.text}
                    maxLength={RANDOM_CARD_TEXT_LIMIT * 2}
                    onChange={e => updateDraftCard(card.id, e.target.value)}
                    className="input"
                    placeholder="Texto o emoji"
                  />
                </div>
              ))}
            </div>

            <button type="button" className="btn btn-sm" style={{ marginTop: '0.75rem' }} onClick={addDraftCard}>+ Agregar carta</button>

            <p className="form-hint">Cada carta admite hasta {RANDOM_CARD_TEXT_LIMIT} caracteres (incluye emojis).</p>

            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={saveConfig} disabled={saving}>
                {saving ? 'Guardando…' : (editingConfigId ? 'Guardar cambios' : 'Guardar configuracion')}
              </button>
              <button type="button" className="btn" onClick={closeModal} disabled={saving}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
    const initialRandomCardConfig = type === 'random_cards' ? createDefaultRandomCardConfig() : null;

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
              type === 'arkham_bag' ? { campaign: '', scenario: '', difficulty: '' } :
              type === 'dice' ? { availableDice: [...ALL_DICE_TYPES] } :
              type === 'special_dice' ? (() => {
                const initialConfig = createDefaultSpecialDiceConfig();
                return { configurations: [initialConfig], selectedConfigId: initialConfig.id };
              })() :
              type === 'random_cards' ? {
                configurations: [initialRandomCardConfig],
                selectedConfigId: initialRandomCardConfig.id
              } : {},
      state: type === 'counter' ? { value: 0 } :
             type === 'stopwatch' ? { startedAt: null, paused: false, pausedElapsed: 0 } :
             type === 'chaosbag' ? {
               bag: ['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'cultist', 'tablet', 'elder_thing', 'tentacle', 'elder_star'],
               drawn: [],
               locked: []
             } :
             type === 'arkham_bag' ? { bag: [], drawn: [], locked: [] } :
             type === 'dice' ? { lastRoll: null, history: [] } :
             type === 'special_dice' ? { lastRoll: null, history: [] } :
             type === 'random_cards' ? {
               remaining: (initialRandomCardConfig?.cards || []).map(c => c.id),
               drawn: [],
               lastDraw: null,
               history: []
             } : {},
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
                      <label className="checkbox-label" style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={tile.config.showControlsToAll || false}
                          onChange={e => updateTile(index, { config: { ...tile.config, showControlsToAll: e.target.checked } })}
                        />
                        Mostrar controles a todos los usuarios
                      </label>
                      <label className="checkbox-label" style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={tile.config.soundEnabled || false}
                          onChange={e => updateTile(index, { config: { ...tile.config, soundEnabled: e.target.checked } })}
                        />
                        Reproducir sonido al llegar a 0
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
                      <label className="checkbox-label" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={tile.config.soundEnabled || false}
                          onChange={e => updateTile(index, { config: { ...tile.config, soundEnabled: e.target.checked } })}
                        />
                        Reproducir sonido al recibir mensajes
                      </label>
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

                  {tile.type === 'dice' && (
                    <div className="form-group">
                      <label>Tipos de dados disponibles</label>
                      <div className="dice-editor-checkboxes">
                        {ALL_DICE_TYPES.map(die => {
                          const checked = (tile.config?.availableDice ?? ALL_DICE_TYPES).includes(die);
                          return (
                            <label key={die} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const current = tile.config?.availableDice ?? ALL_DICE_TYPES;
                                  const next = e.target.checked
                                    ? [...current, die]
                                    : current.filter(d => d !== die);
                                  updateTile(index, { config: { ...tile.config, availableDice: next } });
                                }}
                              />
                              {die}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {tile.type === 'special_dice' && (
                    <SpecialDiceConfigEditor
                      tile={tile}
                      onChange={(updates) => updateTile(index, updates)}
                    />
                  )}

                  {tile.type === 'random_cards' && (
                    <RandomCardsConfigEditor
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
