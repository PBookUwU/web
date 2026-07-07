interface Flag {
  label: string;
  detail: string;
  score: number;
}

export default function FlagList({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-900/50 p-4 text-sm text-slate-400">
        특별히 의심되는 패턴이 발견되지 않았습니다.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {flags.map((flag, idx) => (
        <li
          key={idx}
          className="flex items-start gap-3 rounded-lg border border-ink-800 bg-ink-900/50 p-3"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal-danger/20 text-xs text-signal-danger">
            !
          </span>
          <div>
            <p className="text-sm font-medium text-slate-200">{flag.label}</p>
            <p className="mt-0.5 text-xs text-slate-400">{flag.detail}</p>
          </div>
          <span className="ml-auto shrink-0 text-xs text-slate-500">
            +{flag.score}
          </span>
        </li>
      ))}
    </ul>
  );
}
