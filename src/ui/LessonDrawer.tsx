import { useState } from 'react'
import { useStore } from '../store/store'
import { LESSONS, lessonByNumber } from '../lessons/lessons'
import type { LessonStep } from '../store/store'

/**
 * The lesson drawer.
 *
 * Concept → Listen → Explore → Quiz, the same loop as Synthwise. The drawer sits
 * beside the builder rather than replacing it, so the graph and the schematic
 * are always visible while the text is talking about them.
 */

const STEPS: Array<{ id: LessonStep; label: string }> = [
  { id: 'concept', label: 'Concept' },
  { id: 'listen', label: 'Listen' },
  { id: 'explore', label: 'Explore' },
  { id: 'quiz', label: 'Quiz' },
]

export function LessonDrawer() {
  const n = useStore((s) => s.lesson)
  const step = useStore((s) => s.lessonStep)
  const setStep = useStore((s) => s.setLessonStep)
  const exit = useStore((s) => s.exitLesson)
  const listenSide = useStore((s) => s.listenSide)
  const loadListen = useStore((s) => s.loadListen)
  const loadClip = useStore((s) => s.loadClip)
  const answers = useStore((s) => s.quizAnswers)
  const answer = useStore((s) => s.answerQuiz)
  const complete = useStore((s) => s.completeLesson)
  const progress = useStore((s) => s.progress)
  const startLesson = useStore((s) => s.startLesson)

  const lesson = n !== null ? lessonByNumber(n) : undefined
  if (!lesson) return null

  const idx = STEPS.findIndex((s) => s.id === step)
  const correct = lesson.quiz.filter((q) => answers[q.id] === q.answer).length
  const answered = lesson.quiz.filter((q) => answers[q.id] !== undefined).length
  const passed = correct === lesson.quiz.length

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <button onClick={exit} className="text-xs text-zinc-500 hover:text-zinc-300" title="Back to free build">
          ←
        </button>
        <span className="text-[10.5px] uppercase tracking-wider text-copper-400">Lesson {lesson.n}</span>
        <span className="truncate text-xs font-medium text-zinc-200">{lesson.title}</span>
        <select
          value={lesson.n}
          onChange={(e) => startLesson(Number(e.target.value))}
          className="ml-auto rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300"
          aria-label="Choose lesson"
        >
          {LESSONS.map((l) => (
            <option key={l.n} value={l.n}>
              {l.n}. {l.title} {progress[l.n] ? '✓' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex shrink-0 border-b border-zinc-800">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`flex-1 border-r border-zinc-800 py-1.5 text-[10.5px] uppercase tracking-wider last:border-r-0 ${
              s.id === step ? 'bg-copper-600/15 text-copper-300' : i < idx ? 'text-zinc-400' : 'text-zinc-600'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {step === 'concept' ? (
          <div className="space-y-3">
            <blockquote className="border-l-2 border-copper-600 pl-3 text-[13px] italic leading-relaxed text-copper-200">
              {lesson.key}
            </blockquote>
            {lesson.concept.map((p, i) => (
              <p key={i} className="text-[12.5px] leading-relaxed text-zinc-300">
                {p}
              </p>
            ))}
          </div>
        ) : null}

        {step === 'listen' ? (
          <div className="space-y-3">
            <p className="text-[12.5px] leading-relaxed text-zinc-300">{lesson.listen.prompt}</p>
            <p className="text-[11px] text-zinc-500">
              Press play on the transport bar first, then switch between the two — the change is applied to the
              live build, so the graph moves with the sound.
            </p>
            <div className="flex gap-2">
              {(['a', 'b'] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => loadListen(side)}
                  className={`flex-1 rounded border px-2 py-2 text-left text-[11.5px] transition-colors ${
                    listenSide === side
                      ? 'border-copper-500 bg-copper-600/20 text-copper-100'
                      : 'border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
                    {side === 'a' ? 'Version A' : 'Version B'}
                  </span>
                  {(side === 'a' ? lesson.listen.a : lesson.listen.b).label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 'explore' ? (
          <div className="space-y-3">
            <p className="text-[12.5px] leading-relaxed text-zinc-300">{lesson.explore.prompt}</p>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Controls from later lessons are locked, but still visible — the whole microphone is always on
              screen. The explanation panel below the graph narrates whatever you touch.
            </p>
          </div>
        ) : null}

        {step === 'quiz' ? (
          <div className="space-y-4">
            {lesson.quiz.map((q) => {
              const given = answers[q.id]
              return (
                <div key={q.id}>
                  <p className="mb-1.5 text-[12.5px] leading-relaxed text-zinc-200">{q.question}</p>
                  {q.clips ? (
                    <div className="mb-2 flex gap-2">
                      <button
                        onClick={() => loadClip(q.clips!.a)}
                        className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:border-copper-600"
                      >
                        ▶ Load clip A
                      </button>
                      <button
                        onClick={() => loadClip(q.clips!.b)}
                        className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:border-copper-600"
                      >
                        ▶ Load clip B
                      </button>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    {q.options.map((o, i) => {
                      const isGiven = given === i
                      const isRight = i === q.answer
                      const show = given !== undefined
                      return (
                        <button
                          key={i}
                          onClick={() => answer(q.id, i)}
                          className={`block w-full rounded border px-2 py-1.5 text-left text-[11.5px] leading-snug transition-colors ${
                            show && isRight
                              ? 'border-emerald-700 bg-emerald-950/30 text-emerald-200'
                              : show && isGiven
                                ? 'border-red-800 bg-red-950/30 text-red-200'
                                : 'border-zinc-800 text-zinc-300 hover:border-zinc-600'
                          }`}
                        >
                          {o}
                        </button>
                      )
                    })}
                  </div>
                  {given !== undefined ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{q.explain}</p>
                  ) : null}
                </div>
              )
            })}

            {answered === lesson.quiz.length ? (
              <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-[12px] text-zinc-300">
                  {correct} of {lesson.quiz.length} right.{' '}
                  {passed ? 'Lesson complete.' : 'Have another look at the ones you missed.'}
                </p>
                {passed ? (
                  <NextButton lesson={lesson.n} onComplete={() => complete(lesson.n)} />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-zinc-800 px-3 py-2">
        <button
          disabled={idx === 0}
          onClick={() => setStep(STEPS[idx - 1].id)}
          className="text-[11px] text-zinc-400 disabled:opacity-30"
        >
          ← {idx > 0 ? STEPS[idx - 1].label : ''}
        </button>
        <button
          disabled={idx === STEPS.length - 1}
          onClick={() => setStep(STEPS[idx + 1].id)}
          className="rounded bg-copper-600/20 px-2 py-1 text-[11px] text-copper-200 disabled:opacity-30"
        >
          {idx < STEPS.length - 1 ? STEPS[idx + 1].label : ''} →
        </button>
      </div>
    </aside>
  )
}

function NextButton({ lesson, onComplete }: { lesson: number; onComplete: () => void }) {
  const start = useStore((s) => s.startLesson)
  const [done, setDone] = useState(false)
  const next = LESSONS.find((l) => l.n === lesson + 1)
  return (
    <button
      onClick={() => {
        onComplete()
        setDone(true)
        if (next) start(next.n)
      }}
      className="mt-2 w-full rounded bg-copper-600 px-2 py-1.5 text-[11.5px] text-zinc-950 hover:bg-copper-500"
    >
      {next ? `Mark done and start lesson ${next.n}` : done ? 'All lessons complete' : 'Mark done'}
    </button>
  )
}
