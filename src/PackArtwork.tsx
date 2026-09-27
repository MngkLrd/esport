import type { PackId } from './packState'

export function PackArtwork({
  variant,
  title,
  kicker,
}: {
  variant: PackId
  title: string
  kicker: string
}) {
  return (
    <div className={'pack-artwork pack-artwork-' + variant} aria-hidden="true">
      <div className="pack-artwork-foil" />
      <div className="pack-artwork-seal">E</div>
      <div className="pack-artwork-copy">
        <span>{kicker}</span>
        <strong>{title}</strong>
        <b>CS2 PLAYER CARDS</b>
      </div>
      <div className="pack-artwork-cards">
        <i />
        <i />
        <i />
      </div>
      <div className="pack-artwork-edge" />
    </div>
  )
}
