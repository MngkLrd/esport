# ESPORT AI Manager — продуктовый аудит текущего main

Дата: 2026-09-27  
Анализируемая версия: `main` @ `7444ee017c15e091fc5288766682105233329af0`  
Живая версия: `https://mngklrd.github.io/esport/`

> Важно: незавершённая ветка `feat/welcome-pack-card-ux` в этот аудит и архив **не входит**. Здесь только то, что реально находится в `main` и что сейчас видит пользователь.

---

## 1. Короткий вывод

Проект уже не выглядит пустым макетом. В нём есть реальная state-machine: состав, активная пятёрка, роли, форма, мораль, усталость, контракты, зарплаты, экономика матча, детерминированная BO3-симуляция, скаутинг, localStorage-сейв, паки, коллекция, большой real-player pool и отдельный HLTV-card data layer.

Но с точки зрения пользователя продукт пока ощущается как **две разные игры, склеенные одной навигацией**:

1. менеджер клуба — состав, матчи, скаутинг, контракты, экономика;
2. коллекция карточек — паки, HLTV-статы, редкости, reel/reveal.

Они используют одних и тех же реальных игроков, но живут по разным правилам и почти не влияют друг на друга. Это главная проблема продукта. Пока она не решена, новые экраны, новые паки и новая косметика будут увеличивать объём интерфейса, но не глубину игры.

---

# 2. Полный текущий user flow

## 2.1 Первый запуск

При первом заходе показывается welcome-overlay.

Он объясняет:
- сезон на 12 недель;
- необходимость собрать пятёрку;
- экономику;
- общий менеджерский loop.

Есть две кнопки:
- «Начать сезон»;
- «Сначала посмотреть состав».

### Как это воспринимается

Формально пользователь ожидает старт игры и первое решение. Фактически решение отсутствует: новый сейв уже содержит шесть заранее заданных игроков, а стартовая пятёрка уже выбрана.

То есть onboarding — это не gameplay, а информационная заставка.

### Отдельный баг

Welcome хранится отдельным ключом localStorage. Кнопка «Сбросить сохранение» создаёт свежий GameState, но не очищает welcome-key и не включает welcome снова.

Следствие: после первого прохождения пользователь нажимает «Сбросить сохранение», ожидает настоящий новый старт, но onboarding больше не возвращается.

---

## 2.2 HQ

После welcome пользователь попадает на HQ.

Он видит:
- рейтинг команды;
- химию;
- матчи;
- неделю;
- кредиты;
- зарплаты;
- репутацию;
- очки сезона;
- энергию штаба;
- финансовый итог недели;
- текущую пятёрку;
- стабильность состава;
- доступ к кубку;
- предупреждения;
- последний матч;
- ленту событий.

### Что хорошо

HQ действительно читает канонический state игры. Цифры связаны с последующими действиями, это не декоративный dashboard.

### Что плохо

На пользователя сразу вываливается слишком много сущностей до того, как он понимает их иерархию.

Неясно:
- что сейчас критично;
- что является долгосрочным KPI;
- какое следующее действие рекомендуется.

Визуально рейтинг, химия, стабильность, репутация, staff energy, зарплаты, credits и season points конкурируют между собой.

Нужен один primary objective и 2–3 secondary alerts, а не десять равноправных показателей.

---

## 2.3 Состав

Текущая версия сразу выдаёт шесть игроков:
- пять уже стоят в основе;
- один находится в запасе.

Пользователь может:
- перевести игрока в основу/запас;
- тренировать;
- дать отдых;
- продлить контракт;
- отпустить;
- смотреть форму;
- мораль;
- усталость;
- зарплату;
- срок контракта;
- потенциал;
- игровые статы.

### Что работает

Это одна из наиболее цельных частей проекта.

Перестановки:
- реально снижают lineup continuity;
- влияют на chemistry;
- отсутствие IGL/AWP создаёт штраф;
- fatigue реально влияет на результат;
- контракт может заблокировать старт;
- bench имеет смысл.

### Главная проблема

Один и тот же реальный игрок существует одновременно как минимум в двух разных числовых моделях.

Например:
- карточка игрока имеет HLTV-derived `AIM / UTL / POS / CLU / OVR`;
- игрок состава имеет simulation `aim / gameSense / utility / clutch / leadership`.

Поэтому пользователь может видеть разные оценки одного человека и не понимать, какая из них «настоящая».

---

## 2.4 Подготовка к матчу

Пользователь выбирает одну из трёх тактик:

- balanced;
- aggressive;
- structured.

После этого выбирает режим:

- тренировочный микс;
- шоуматч;
- онлайн-кубок.

Кубок закрыт до 2 побед или 45 репутации.

### Что работает

Тактики действительно участвуют в расчёте. Это не fake-choice.

### Что не работает как UX

Тактика объясняется преимущественно текстом.

Пользователь не видит:
- насколько именно его текущая пятёрка подходит под стиль;
- какие игроки усиливают/ослабляют выбор;
- приблизительный риск;
- что он выигрывает и чем жертвует.

Через несколько матчей выбор рискует превратиться в механическое нажатие одной привычной кнопки.

---

## 2.5 Матч

Матч — детерминированная BO3-симуляция.

Учитываются:
- active five;
- base team rating;
- chemistry;
- continuity;
- form;
- morale;
- fatigue;
- IGL/AWP coverage;
- tactic;
- opponent rating;
- map-to-map momentum;
- seeded RNG.

После матча сохраняются:
- карты;
- счёт;
- win chance;
- player performance;
- MVP;
- income;
- payroll;
- net;
- fan delta;
- narrative result.

### Что хорошо

Это хороший skeleton для management game. Результат связан с состоянием клуба.

### Чего не хватает

До матча пользователь принимает слишком мало решений.

Нет:
- map veto;
- map strengths;
- opponent scouting;
- конкретной подготовки против соперника;
- substitutions;
- timeout decisions;
- side choices;
- серии турнира;
- persistent opponent rosters.

Поэтому матч пока остаётся в значительной степени black box: выбрал одну из трёх тактик → нажал BO3 → получил текстовый результат.

---

## 2.6 Экономика

После каждого матча:
- проходит неделя;
- клуб получает доход;
- платит payroll всего roster;
- меняется финансовый итог;
- уменьшаются контракты;
- fatigue/morale/form обновляются.

Подписание и продление имеют цену.

### Что хорошо

Credits — не просто декоративный ресурс. Есть реальный recurring cost.

### Что пока поверхностно

Контракты — это fixed-price buttons.

Нет:
- требований игрока;
- переговоров;
- подписного бонуса;
- роли в составе;
- конкурирующих предложений;
- отказа;
- walk-away состояния;
- рыночной стоимости.

Экономика работает как constraint, но пока не стала самостоятельной стратегической системой.

---

## 2.7 Скаутинг

За 300 кредитов генерируются три prospect-а из большого real-player pool.

Реальная идентичность может включать:
- alias;
- real name;
- country;
- age;
- team;
- role.

При этом gameplay-stats, potential и salary генерирует симуляция.

### Проблемы

**1. UI обещает поиск «под конкретную задачу», но задачи выбрать нельзя.**

Нет фильтра:
- роль;
- возраст;
- бюджет;
- team region;
- playstyle;
- min potential.

**2. Неизвестный возраст превращается в 0.**

В коде используется `identity.age ?? 0`, поэтому long-tail игрок без metadata может выглядеть как игрок «0 лет».

**3. Неизвестная роль может быть назначена случайно.**

Это может расходиться с карточным/реальным профилем.

**4. Real-player identity используется как skin для procedural prospect.**

Игровая сила реального игрока не является единой сущностью во всём проекте.

---

## 2.8 Паки

Есть четыре платных варианта:

- Academy;
- Challenger;
- Major;
- Afterdark.

Каждый имеет:
- цену;
- weights редкости;
- reel animation;
- winner;
- reveal;
- history;
- duplicate tracking.

### Что работает

Pack RNG привязан к save и serial, поэтому результат нельзя переиграть простым reload.

### Главная UX-проблема

Продукт называет это **pack**, но механика ближе к CS-case opening.

В reel показывается 46 карт, но пользователь получает ровно одну.

Если пользователь видит «пак карточек», интуитивное ожидание — получить несколько карточек из одной упаковки.

Нужно либо:
- честно называть это кейсом/капсулой;
- либо реально делать pack из нескольких cards.

### Визуальная проблема

Pack tile сейчас — это прямоугольный article:
- eyebrow;
- title;
- paragraph;
- три odds;
- button.

Он не выглядит как предмет, который хочется открыть.

Нет:
- artwork;
- foil;
- упаковки;
- собственной композиции;
- distinct identity между pack types.

### Odds

Сейчас непосредственно в pack tile показываются только:
- rare;
- epic;
- legendary.

Common и uncommon визуально отсутствуют, хотя участвуют в roll.

---

## 2.9 Reveal

Reveal — наиболее «игровая» часть карточной системы:
- свет;
- лучи;
- rarity color;
- крупная карта;
- OVR;
- role;
- edition;
- portrait;
- team.

### Проблема

После красивого reveal пользователь всё равно не может открыть карточку и узнать детали.

Кроме того, прямо в reveal показывается техническая мета вида:
- `HLTV current`;
- `HLTV matches`;
- period;
- maps;
- source.

Для data audit это полезно. Для игрового reveal — перегружает эмоцию.

Источник должен жить:
- в Credits;
- максимум в небольшом tooltip/info icon.

---

## 2.10 Коллекция

Коллекция умеет:
- считать total;
- unique;
- duplicates;
- legendary;
- best power;
- искать;
- фильтровать;
- показывать историю.

### Что сломано с точки зрения пользователя

Карточки **не кликабельны**.

Нельзя узнать:
- настоящее имя;
- возраст;
- подробный период;
- конкретный год;
- rating;
- ADR;
- KAST;
- maps;
- дополнительную статистику;
- карьерный контекст.

Карточка по сути заканчивается на thumbnail.

### Более глубокая проблема

Карты почти не влияют на club management.

Поэтому у пользователя возникает вопрос:

> «Зачем мне собирать эту коллекцию, кроме самого факта коллекции?»

Если карточная система должна быть центральной, она должна участвовать в roster acquisition.

Если она косметическая — её не стоит делать настолько большой частью продукта.

---

## 2.11 Фото игроков

Текущий portrait manifest:

- 317 игроков с mapped portrait;
- 1 634 игрока в общем pool;
- coverage ≈ 19.4%.

Поэтому отсутствие фотографии у Fajr — не единичный баг. Это системная проблема.

Сейчас при отсутствии mapping:
- `playerPhoto()` возвращает null;
- пользователь видит monogram.

При ошибке CDN:
- `<img>` просто скрывается;
- другого fallback URL нет.

При этом card snapshot уже знает HLTV `playerId` для большого количества игроков. Portrait pipeline это почти не использует.

### Что нужно

1. Сначала curated/current bodyshot URL.
2. Затем fallback URL по HLTV playerId.
3. Затем ещё один static/thumb fallback.
4. Кеш успешного варианта.
5. Только потом monogram.

---

## 2.12 Inbox

Inbox хранит:
- match events;
- finance;
- lineup;
- scouting;
- contracts.

Это полезный audit log.

Но сейчас он в основном повторяет действия, которые пользователь уже видел.

Чтобы стать самостоятельной игровой системой, ему нужны:
- медиа;
- конфликты;
- negotiations;
- board goals;
- rivalries;
- player requests;
- deadlines.

---

## 2.13 AI Director

Сейчас AI Director на самом деле rule-based advisor.

Это честно написано в интерфейсе.

### Но с точки зрения пользователя

Вкладка называется `AI Director`, а внутри значительная часть пространства объясняет:
- canonical state;
- architecture;
- LLM boundary;
- seed.

Это выглядит как developer demo.

До появления реального assistant-а лучше:
- переименовать в «Штаб» / «Ассистент»;
- убрать debug panel;
- показывать только конкретные рекомендации.

---

## 2.14 Credits

Credits полезен с точки зрения прозрачности и IP boundary.

Но он одновременно:
- находится в top-level tabs;
- доступен через footer.

Это лишнее дублирование навигации.

Для игрока Credits должен быть вторичным экраном из footer/about.

---

## 2.15 Сохранение

Сейв хранится в localStorage.

### Плюсы

- быстро;
- не нужен backend;
- state versioned;
- есть migration.

### Ограничения

Нет:
- save slots;
- export/import;
- cloud sync;
- account;
- cross-device;
- backup;
- recovery.

Для прототипа это нормально, но для длинного management game становится критично.

---

## 2.16 Конец сезона

Интерфейс обещает сезон на 12 недель.

Но season-end системы нет.

Нет:
- блокировки после week 12;
- финальной таблицы;
- summary;
- objectives;
- rewards;
- owner evaluation;
- offseason;
- перехода в следующий сезон.

То есть можно продолжать играть дальше заявленной длины.

Это прямой разрыв между обещанием onboarding-а и реальным поведением.

---

# 3. Главная архитектурная UX-проблема: игрок не является одной сущностью

Сейчас есть три слоя.

## A. Real identity

- alias;
- realName;
- country;
- team;
- age;
- role.

## B. Collectible card

- AIM;
- UTL;
- POS;
- CLU;
- OVR;
- rarity;
- edition;
- HLTV period.

## C. Management player

- aim;
- gameSense;
- utility;
- clutch;
- leadership;
- form;
- morale;
- fatigue;
- potential;
- salary;
- contract.

Пользователь не знает, почему у одного и того же игрока разные цифры в разных местах.

### Рекомендуемая модель

Карточка должна стать base sporting profile:

- card AIM → base aim;
- card POS → base gameSense;
- card UTL → base utility;
- card CLU → base clutch;
- role/metadata → leadership baseline;
- potential → growth ceiling;
- salary/contract → economy;
- form/morale/fatigue/chemistry → динамический modifier.

Тогда существует **один игрок**, у которого есть:
- базовая карточка;
- динамическое состояние в клубе.

---

# 4. Card-data слой: что хорошо и где риск

Общий pool: **1 634 игрока**.

Текущий snapshot:
- usable card stats: **1 431**;
- direct HLTV PlayerScreen: **1 153**;
- last-12-month HLTV-derived: **276**;
- historical fallback: **2**;
- recognized/no usable stats: **130**;
- unmatched: **73**.

Для прототипа покрытие хорошее.

### Но есть статистическая проблема

Direct PlayerScreen skill scores и percentile-derived match scores смешиваются в одной шкале 1–99.

Они выглядят сопоставимо визуально, но это не одна и та же измерительная система.

Rarity percentile уменьшает часть эффекта, но OVR всё равно сравнивает игроков, рассчитанных разными методами.

### Нужно

Либо:
- калибровать distributions;
- либо разделять series;
- либо считать четыре card-score одним единым методом.

---

# 5. Year/edition система пока почти не существует

Архитектура уже умеет:
- `past3m`;
- `last12m`;
- `calendar-year`.

Но текущий snapshot содержит всего **2 historical fallback cards**.

Следовательно, идея карточек «игрок 2015», «игрок 2020», «игрок 2026» пока не реализована как настоящая collectible history.

Сейчас edition чаще обозначает текущий период, а не самостоятельный исторический выпуск.

Если yearly cards — важная часть продукта, нужен отдельный historical dataset по каждому player-year.

---

# 6. Дизайн и визуальное восприятие

## Что уже хорошо

- единая dark palette;
- orange/cyan accents;
- аккуратный dashboard rhythm;
- reveal визуально сильнее обычных панелей;
- карточка уже имеет понятную структуру OVR → role → portrait → identity.

## Почему всё ещё ощущается как prototype/admin dashboard

- слишком много объясняющего текста;
- source/data terminology прямо в gameplay;
- почти все блоки — одинаковые прямоугольные panels;
- слабая визуальная идентичность соревнований;
- паки не имеют собственного art;
- main CTA часто теряется среди метрик;
- debug/architecture copy попадает в обычный user flow.

---

# 7. Типографика

Это не субъективное ощущение — в CSS реально есть крайности.

Встречаются:
- 5 px;
- 6 px;
- 7 px;
- 8 px;
- 9 px labels;

при этом:
- h1 до ~62 px;
- reveal heading до ~74 px.

Collection на desktop выводится в **8 колонок**, что дополнительно уменьшает полезный размер карты.

### Рекомендуемая шкала

- body: 14–16 px;
- secondary text: 12–13 px;
- UI labels: минимум 10–11 px;
- buttons: 12–14 px;
- h1: 36–48 px;
- reveal title: 48–56 px;
- mono использовать преимущественно для numbers/compact metadata.

Главное: убрать сочетание `7px + uppercase + letter-spacing`, оно особенно плохо читается.

---

# 8. Что реально не работает / недоделано

## P0 — ломает целостность продукта

1. Новый сейв сразу получает готовый roster.
2. Нет welcome pack на пять игроков.
3. Collectible cards не кликабельны.
4. Card layer и roster layer не являются одной системой.
5. Season-end отсутствует.
6. Reset не возвращает onboarding.
7. Portrait coverage ≈19.4%.
8. HLTV refresh workflow всё ещё привязан к старой ветке `feat/hltv-card-snapshots`, а не к `main`.
9. В refresh workflow захардкожены даты.
10. Основной game state почти не покрыт unit tests.

## P1 — заметно портит UX

11. Pack tiles не выглядят как паки.
12. Odds отображаются не полностью.
13. Источник данных дублируется в gameplay.
14. Collection cards слишком маленькие.
15. Типографическая шкала не выровнена.
16. Credits занимает top-level tab.
17. AI Director выглядит как dev screen.
18. Unknown player age может показываться как 0.
19. Scouting не позволяет реально искать «под задачу».
20. Карточка не объясняет edition/year.

## P2 — быстро съедает глубину игры

21. Нет veto.
22. Нет map-specific strengths.
23. Нет persistent opponents.
24. Нет tournament bracket.
25. Нет calendar events.
26. Нет contract negotiation.
27. Нет offseason.
28. Нет owner objectives.
29. Нет meaningful duplicate use.
30. Нет pack progression/reward loop.
31. Нет save export/import.

---

# 9. Инженерные проблемы, которые увидит разработчик

## Нет lockfile

В репозитории нет `package-lock.json`, а workflow использует `npm install`.

Dependencies в `package.json` заданы через `^`.

Следствие: один и тот же commit может получить другой dependency graph в другое время.

Нужно:
- commit `package-lock.json`;
- перейти на `npm ci`.

## Tests

Сейчас тесты хорошо проверяют card pipeline:
- pool size;
- snapshot coverage;
- card ranges;
- known players;
- rarity pools;
- deterministic pack rolls;
- pack migration.

Но не проверяются главные management invariants:
- payroll;
- contracts;
- week transition;
- lineup changes;
- fatigue;
- scouting;
- signing;
- season end;
- localStorage migration behavior.

Нет E2E flow:
`new game → first match → recruit/open pack → reload`.

## HLTV workflows

`hltv-card-snapshot.yml` и `hltv-mobile-smoke.yml` всё ещё таргетят старую feature branch.

Это означает, что текущий `main` не получает нормальный автоматический refresh data layer.

## Bundle

Pack/HLTV data уже lazy-loaded, что хорошо.

Но initial JS всё ещё сравнительно крупный для такого интерфейса, а big generated TS snapshot остаётся большим client-side asset.

---

# 10. Рекомендуемый целевой user flow

## Новый сейв

1. Logo / короткий intro.
2. Одна CTA: «Открыть стартовый набор».
3. Welcome pack содержит ровно 5 cards.
4. Карты раскрываются по одной.
5. Каждую можно открыть подробнее.
6. Финальный экран показывает всю пятёрку и role coverage.
7. Эти пять карт становятся первым roster и starting five.
8. HQ ставит одну конкретную задачу: подготовиться к первой серии.

## Core loop

`roster → prepare → match → consequences → improve → next week`

### Improve должен иметь два связанных канала

**Scouting**
- целевой поиск;
- прямое подписание;
- дороже, но предсказуемее.

**Packs**
- случайное acquisition;
- дешевле/награды;
- риск редкости.

Оба способа должны создавать одну и ту же сущность игрока.

---

# 11. Каким должен быть detail игрока

По клику на любую карточку:

- portrait;
- alias;
- real name;
- country;
- team;
- age;
- role;
- card edition/year;
- OVR;
- AIM;
- UTL;
- POS;
- CLU;
- rating;
- ADR;
- KAST;
- maps;
- period;
- roster form/morale/fatigue, если игрок подписан;
- salary/contract, если игрок в клубе.

Data source не нужен большим текстом. Достаточно маленькой info-ссылки в Credits.

---

# 12. Каким должен быть pack

Pack — визуальный объект, а не panel.

Нужно:
- artwork;
- pack identity;
- foil/material;
- короткое описание;
- price;
- полный rarity breakdown;
- число карт внутри;
- guaranteed rarity, если есть;
- понятная CTA.

Если внутри одна карта — лучше переименовать в case/capsule.

---

# 13. Приоритет разработки

## P0 — сначала

1. Welcome pack → первые 5 игроков.
2. Единая модель card ↔ roster.
3. Card detail modal.
4. Portrait fallback по HLTV playerId.
5. Season-end.
6. Full reset onboarding.
7. Убрать технический source-copy из gameplay.

## P1

8. Pack-art.
9. Type scale.
10. 5–6 collection columns вместо 8.
11. Role-targeted scouting.
12. Убрать Credits из main nav.
13. AI Director → нормальный игровый штаб.

## P2

14. Map veto.
15. Map strengths.
16. Contract negotiation.
17. Persistent opponents.
18. Calendar/objectives.
19. Duplicate economy.
20. Pack rewards.
21. Save export/import.

## P3

22. `package-lock.json`.
23. `npm ci`.
24. Game-state unit tests.
25. E2E smoke.
26. Dynamic data refresh.
27. Portrait refresh.
28. Card-score calibration tests.

---

# 14. Что я бы пока не добавлял

До решения core-flow я бы не добавлял:

- новые currencies;
- ещё больше pack types;
- настоящий LLM;
- десятки новых tabs;
- магазин косметики;
- сложные reveal effects.

Это расширит проект в стороны, но не исправит ощущение, что системы не связаны.

---

# 15. Итоговая оценка состояния

Как **технический prototype** проект уже убедительный:
- есть детерминированная симуляция;
- реальный state;
- экономика;
- save migration;
- data pipeline;
- 1 634-player pool;
- CI;
- Pages;
- card smoke tests.

Как **игра для конечного пользователя** он пока не имеет одного ясного fantasy-loop.

Сейчас пользователь одновременно видит:
- manager;
- case-opening simulator;
- card collection;
- stats viewer;
- architecture demo.

Наиболее логичное направление по уже построенным системам:

> **Ты строишь CS2-клуб из карточек реальных игроков, а менеджмент превращает базовую силу карты в динамический результат сезона.**

Если принять эту формулу, welcome-pack, roster, scouting, contracts, packs, collection и матч-симуляция начинают работать как одна игра, а не как набор отдельных модулей.
