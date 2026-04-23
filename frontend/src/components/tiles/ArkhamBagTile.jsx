import { useState } from 'react';
import ChaosBagTile from './ChaosBagTile';

const DIFFICULTY_Y = { 'Fácil': 2, 'Normal': 3, 'Difícil': 4, 'Experto': 5 };

export default function ArkhamBagTile({ tile, socket, isOwnerOrAdmin, user, guestName, boardLocked }) {
  const config = tile.config || {};
  const [showScenarioInfo, setShowScenarioInfo] = useState(false);

  const presetLabel = config.campaign && config.scenario && config.difficulty
    ? `${config.campaign} — ${config.scenario} (${config.difficulty})`
    : null;

  const y = DIFFICULTY_Y[config.difficulty];
  const x = config.scenarioValue;
  const experience = (y != null && x != null) ? y * (x - 1) : null;

  const hasScenarioInfo = config.campaignLog || config.victoryRequirements || experience != null;

  return (
    <div className="tile tile-arkham-bag">
      <h3 className="tile-label">{tile.label || 'Bolsa PAP'}</h3>
      {presetLabel && (
        <div className="arkham-preset-header">
          <div className="arkham-preset-label">{presetLabel}</div>
          {hasScenarioInfo && (
            <button
              className="btn-ghost arkham-info-toggle"
              onClick={() => setShowScenarioInfo(v => !v)}
              title={showScenarioInfo ? 'Ocultar datos del escenario' : 'Mostrar datos del escenario'}
            >
              {showScenarioInfo ? '▲' : '▼'} Datos PAP
            </button>
          )}
        </div>
      )}
      {showScenarioInfo && hasScenarioInfo && (
        <div className="arkham-scenario-info">
          {experience != null && (
            <div className="arkham-info-row arkham-exp-row">
              <span className="arkham-info-label">EXP</span>
              <span className="arkham-exp-value">{experience}</span>
            </div>
          )}
          {config.victoryRequirements && (
            <div className="arkham-info-row">
              <span className="arkham-info-label">Victoria</span>
              <span className="arkham-info-text">{config.victoryRequirements}</span>
            </div>
          )}
          {config.campaignLog && (
            <div className="arkham-info-row">
              <span className="arkham-info-label">Registro</span>
              <span className="arkham-info-text">{config.campaignLog}</span>
            </div>
          )}
        </div>
      )}
      <ChaosBagTile
        tile={tile}
        socket={socket}
        isOwnerOrAdmin={isOwnerOrAdmin}
        user={user}
        guestName={guestName}
        boardLocked={boardLocked}
        embedded
      />
    </div>
  );
}
