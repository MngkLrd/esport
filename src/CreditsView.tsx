const credits = [
  {
    name: 'Adam Sadek · Case-Opening',
    url: 'https://github.com/AdamSadek/Case-Opening',
    license: 'Apache-2.0',
    use: 'Референс для классической горизонтальной ленты, центрального маркера и длинного замедления. Реализация менеджера переписана на React/TypeScript и не импортирует исходные файлы.',
  },
  {
    name: 'Leon Larsson · case-sim',
    url: 'https://github.com/leonlarsson/case-sim',
    license: 'Лицензия репозитория не обнаружена',
    use: 'Только референс поведения и UI: содержимое набора, показ результата, редкость и история коллекции. Исходный код, аудио и изображения в проект не копировались.',
  },
  {
    name: 'nc-gp · roulette',
    url: 'https://github.com/nc-gp/roulette',
    license: 'GPL-3.0',
    use: 'Только референс взаимодействия. GPL-реализация намеренно не копируется в этот проект.',
  },
  {
    name: 'ValveSoftware · counter-strike_regional_standings',
    url: 'https://github.com/ValveSoftware/counter-strike_regional_standings',
    license: 'Лицензия репозитория не обнаружена',
    use: 'Срез рейтинга составов используется как основа большой базы игроков и команд. Принадлежность к команде считается данными конкретного среза, а не утверждением о текущем контракте.',
  },
  {
    name: 'PHSix · guess_cspro',
    url: 'https://github.com/PHSix/guess_cspro',
    license: 'MIT',
    use: 'Датасет профилей сообщества используется как один из источников публичных данных игроков и сохранённых ссылок на портреты HLTV.',
  },
  {
    name: 'Sopenfi · skindle',
    url: 'https://github.com/Sopenfi/skindle',
    license: 'Лицензия репозитория не обнаружена',
    use: 'Срез профилей сообщества используется для обогащения имён игроков, стран, ролей, возраста и ссылок на портреты там, где найдено совпадение.',
  },
  {
    name: 'jLidak · cs2_players_tracker',
    url: 'https://github.com/jLidak/cs2_players_tracker',
    license: 'Лицензия репозитория не обнаружена',
    use: 'Свежий срез сообщества за 2026 год используется как приоритетный источник ссылок на портреты игроков при найденном совпадении.',
  },
]

export function CreditsView() {
  return (
    <section className="screen narrow credits-screen">
      <div className="section-title">
        <div>
          <div className="eyebrow">АВТОРСТВО · ИСТОЧНИКИ · ЛИЦЕНЗИИ</div>
          <h1>Личный менеджерский проект с открытым указанием источников.</h1>
        </div>
      </div>

      <div className="credits-note">
        <strong>Границы проекта</strong>
        <p>
          Это личный некоммерческий фанатский менеджер. Counter-Strike, символика команд, фотографии игроков и сторонние
          данные остаются собственностью их правообладателей. Публичность репозитория GitHub сама по себе не означает,
          что его код или медиа можно свободно переиспользовать, поэтому проекты без лицензии и GPL ниже используются как референсы, а не как скопированный исходный код.
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
            <a href={credit.url} target="_blank" rel="noreferrer">Открыть источник ↗</a>
          </article>
        ))}
      </div>

      <div className="credits-note">
        <strong>Работа с портретами</strong>
        <p>
          Фотографии игроков загружаются удалённо из исходного CDN, если найдено проверенное соответствие ника и изображения.
          Они не хранятся в этом репозитории. При отсутствии или ошибке изображения используется сгенерированная текстовая карточка.
        </p>
      </div>
    </section>
  )
}
