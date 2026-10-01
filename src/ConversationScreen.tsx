import { useEffect, useMemo, useState, type ReactNode } from 'react'

export type ConversationTone = 'supportive' | 'direct' | 'calm' | 'ambitious'

export interface ConversationChoice {
  id: string
  label: string
  detail?: string
  response: string
  tone?: ConversationTone
}

export interface ConversationParticipant {
  name: string
  role: string
  meta?: string
  portrait?: ReactNode
  badge?: ReactNode
}

export interface ConversationContextItem {
  label: string
  value: string
  emphasis?: 'positive' | 'warning' | 'neutral'
}

interface ConversationScreenProps {
  eyebrow: string
  title: string
  subtitle?: string
  participant: ConversationParticipant
  openingLines: string[]
  objective?: string
  context?: ConversationContextItem[]
  choices: ConversationChoice[]
  onChoose?: (choice: ConversationChoice) => void
  onComplete?: (choice: ConversationChoice) => void
  onClose: () => void
}

const TONE_LABELS: Record<ConversationTone, string> = {
  supportive: 'ПОДДЕРЖАТЬ',
  direct: 'ПРЯМО',
  calm: 'СПОКОЙНО',
  ambitious: 'АМБИЦИОЗНО',
}

export function ConversationScreen({
  eyebrow,
  title,
  subtitle,
  participant,
  openingLines,
  objective,
  context = [],
  choices,
  onChoose,
  onComplete,
  onClose,
}: ConversationScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(
    () => choices.find((choice) => choice.id === selectedId) ?? null,
    [choices, selectedId],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const choose = (choice: ConversationChoice) => {
    if (selectedId) return
    setSelectedId(choice.id)
    onChoose?.(choice)
  }

  const finish = () => {
    if (selected && onComplete) {
      onComplete(selected)
      return
    }
    onClose()
  }

  return (
    <div className="conversation-screen" role="dialog" aria-modal="true" aria-label={title}>
      <header className="conversation-topbar">
        <button className="conversation-back" type="button" onClick={onClose} aria-label="Закрыть встречу">←</button>
        <div className="conversation-title">
          <span>{eyebrow}</span>
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
        </div>
        <button className="conversation-done" type="button" onClick={selected ? finish : onClose}>
          {selected ? 'Завершить' : 'Закрыть'} <span>→</span>
        </button>
      </header>

      <div className="conversation-workspace">
        <aside className="conversation-participant">
          <div className="conversation-portrait">
            {participant.portrait ?? <span className="conversation-portrait-fallback">{participant.name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="conversation-person-copy">
            <span>{participant.role}</span>
            <h2>{participant.name}</h2>
            {participant.meta && <p>{participant.meta}</p>}
          </div>
          {participant.badge && <div className="conversation-person-badge">{participant.badge}</div>}
        </aside>

        <main className="conversation-main">
          <section className="conversation-thread" aria-live="polite">
            <div className="conversation-thread-head">
              <span>ВСТРЕЧА</span>
              <small>{selected ? 'РЕШЕНИЕ ПРИНЯТО' : 'ОЖИДАЕТ ВАШЕГО ОТВЕТА'}</small>
            </div>

            <div className="conversation-lines">
              {openingLines.map((line, index) => (
                <article className="conversation-line is-them" key={index}>
                  <div className="conversation-line-mark">{participant.name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <span>{participant.name}</span>
                    <p>{line}</p>
                  </div>
                </article>
              ))}

              {selected && (
                <>
                  <article className="conversation-line is-you">
                    <div className="conversation-line-mark">M</div>
                    <div>
                      <span>МЕНЕДЖЕР · {selected.tone ? TONE_LABELS[selected.tone] : 'ОТВЕТ'}</span>
                      <p>{selected.label}</p>
                    </div>
                  </article>
                  <article className="conversation-line is-them is-response">
                    <div className="conversation-line-mark">{participant.name.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <span>{participant.name}</span>
                      <p>{selected.response}</p>
                    </div>
                  </article>
                </>
              )}
            </div>
          </section>

          <section className="conversation-actions">
            <div className="conversation-actions-head">
              <div>
                <span>{selected ? 'ВАШ ОТВЕТ' : 'КАК ОТВЕТИТЬ'}</span>
                <strong>{selected ? 'Диалог завершён' : 'Выберите тон и позицию'}</strong>
              </div>
              {!selected && <small>{choices.length} ВАРИАНТА</small>}
            </div>

            {!selected ? (
              <div className="conversation-choice-grid">
                {choices.map((choice, index) => (
                  <button key={choice.id} type="button" onClick={() => choose(choice)}>
                    <span className={'conversation-tone tone-' + (choice.tone ?? 'calm')}>
                      {choice.tone ? TONE_LABELS[choice.tone] : 'ОТВЕТ'}
                    </span>
                    <strong>{choice.label}</strong>
                    {choice.detail && <small>{choice.detail}</small>}
                    <i>{String(index + 1).padStart(2, '0')}</i>
                  </button>
                ))}
              </div>
            ) : (
              <div className="conversation-resolution">
                <span>ИТОГ ВСТРЕЧИ</span>
                <strong>{selected.label}</strong>
                <p>{selected.response}</p>
                <button type="button" onClick={finish}>{onComplete ? 'Подтвердить' : 'Вернуться'} <span>→</span></button>
              </div>
            )}
          </section>
        </main>

        <aside className="conversation-context">
          {objective && (
            <section>
              <span className="conversation-section-label">ЦЕЛЬ ВСТРЕЧИ</span>
              <p>{objective}</p>
            </section>
          )}

          <section>
            <span className="conversation-section-label">КОНТЕКСТ</span>
            <div className="conversation-context-list">
              {context.map((item) => (
                <div key={item.label} className={item.emphasis ? 'is-' + item.emphasis : ''}>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="conversation-help">
            <span className="conversation-section-label">ПОДСКАЗКА</span>
            <p>Тон ответа влияет на ощущение разговора. Система готова для привязки к морали, контрактам, обещаниям и конфликтам.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
