import ChaosBagTile from './ChaosBagTile';

export default function ArkhamBagTile({ tile, socket, isOwnerOrAdmin, user, guestName, boardLocked }) {
  const config = tile.config || {};
  const presetLabel = config.campaign && config.scenario && config.difficulty
    ? `${config.campaign} — ${config.scenario} (${config.difficulty})`
    : null;

  return (
    <div className="tile tile-arkham-bag">
      <h3 className="tile-label">{tile.label || 'Bolsa PAP'}</h3>
      {presetLabel && (
        <div className="arkham-preset-info">{presetLabel}</div>
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
