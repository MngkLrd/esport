import type { PackId } from './packState'

const PACK_ART: Record<PackId, string> = {
  welcome: new URL('./assets/packs/academy.webp', import.meta.url).href,
  academy: new URL('./assets/packs/academy.webp', import.meta.url).href,
  challenger: new URL('./assets/packs/challenger.webp', import.meta.url).href,
  major: new URL('./assets/packs/major.webp', import.meta.url).href,
  afterdark: new URL('./assets/packs/afterdark.webp', import.meta.url).href,
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
