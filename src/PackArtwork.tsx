import type { PackId } from './packState'
import academyPack from './assets/packs/academy.webp'
import challengerPack from './assets/packs/challenger.webp'
import majorPack from './assets/packs/major.webp'
import afterdarkPack from './assets/packs/afterdark.webp'

const PACK_ART: Record<PackId, string> = {
  welcome: academyPack,
  academy: academyPack,
  challenger: challengerPack,
  major: majorPack,
  afterdark: afterdarkPack,
}

export function PackArtwork({
  variant,
  title,
}: {
  variant: PackId
  title: string
  kicker: string
}) {
  return (
    <div className={'pack-artwork pack-artwork-final pack-artwork-' + variant}>
      <img src={PACK_ART[variant]} alt={title} draggable={false} />
    </div>
  )
}
