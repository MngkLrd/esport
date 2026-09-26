const credits = [
  {
    name: 'Adam Sadek · Case-Opening',
    url: 'https://github.com/AdamSadek/Case-Opening',
    license: 'Apache-2.0',
    use: 'Reference for the classic horizontal case reel, center marker and long deceleration curve. The manager implementation is rewritten in React/TypeScript and does not import the original files.',
  },
  {
    name: 'Leon Larsson · case-sim',
    url: 'https://github.com/leonlarsson/case-sim',
    license: 'No repository license detected',
    use: 'Behavior/UI reference only: case contents, reveal flow, rarity feedback and collection history. No source code, audio or image assets are copied into this project.',
  },
  {
    name: 'nc-gp · roulette',
    url: 'https://github.com/nc-gp/roulette',
    license: 'GPL-3.0',
    use: 'Interaction reference only. We intentionally do not copy its GPL implementation into this project.',
  },
  {
    name: 'ValveSoftware · counter-strike_regional_standings',
    url: 'https://github.com/ValveSoftware/counter-strike_regional_standings',
    license: 'No repository license detected',
    use: 'Roster-ranking snapshot used to seed the large player/team universe. Team affiliation is treated as snapshot data, not a permanent contract claim.',
  },
  {
    name: 'PHSix · guess_cspro',
    url: 'https://github.com/PHSix/guess_cspro',
    license: 'MIT',
    use: 'Community profile dataset used as one source for public player identity metadata and preserved HLTV portrait URLs.',
  },
  {
    name: 'Sopenfi · skindle',
    url: 'https://github.com/Sopenfi/skindle',
    license: 'No repository license detected',
    use: 'Community profile snapshot used to enrich public player names, countries, roles, ages and portrait URLs where matched.',
  },
  {
    name: 'jLidak · cs2_players_tracker',
    url: 'https://github.com/jLidak/cs2_players_tracker',
    license: 'No repository license detected',
    use: 'Fresh 2026 community snapshot used as a high-priority source for matched public player portrait URLs.',
  },
]

export function CreditsView() {
  return (
    <section className="screen narrow credits-screen">
      <div className="section-title">
        <div>
          <div className="eyebrow">CREDITS · SOURCES · LICENSE NOTES</div>
          <h1>Built for a personal manager save, with attribution kept visible.</h1>
        </div>
      </div>

      <div className="credits-note">
        <strong>Project boundary</strong>
        <p>
          This is a personal, non-commercial fan manager. Counter-Strike, team marks, player photographs and third-party
          data remain the property of their respective owners. A GitHub repository being public does not automatically
          make its code or media reusable, so unlicensed and GPL projects below are used as references rather than copied source.
        </p>
      </div>

      <div className="credits-list">
        {credits.map((credit) => (
          <article key={credit.url}>
            <div>
              <span>{credit.license}</span>
              <h2>{credit.name}</h2>
              <p>{credit.use}</p>
            </div>
            <a href={credit.url} target="_blank" rel="noreferrer">Open source ↗</a>
          </article>
        ))}
      </div>

      <div className="credits-note">
        <strong>Portrait handling</strong>
        <p>
          Player photographs are currently loaded remotely from their source CDN when a verified alias-to-image mapping exists.
          They are not committed into this repository. Missing or broken images fall back to generated text cards.
        </p>
      </div>
    </section>
  )
}
