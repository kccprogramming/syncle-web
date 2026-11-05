/** 작은 입력 부품들: 스위치, 체크 상자, 라디오 */

export function Switch({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? " switch--on" : ""}`}
      onClick={() => onChange(!on)}
    />
  );
}

export function CheckBox({ on }: { on: boolean }) {
  return (
    <span className={`checkbox${on ? " checkbox--on" : ""}`} aria-hidden="true">
      {on ? "✓" : ""}
    </span>
  );
}

export function Radio({ on }: { on: boolean }) {
  return <span className={`radio${on ? " radio--on" : ""}`} aria-hidden="true" />;
}
